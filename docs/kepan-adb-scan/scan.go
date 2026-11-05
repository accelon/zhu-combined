// 臨時探針：掃 Library.adb 每部書的正文，找「甲一」「丙二」這種科判序號。
//   go run ./build/tmp-kepan-scan <adb> [head|ctx <詞>]
//
// 結構：整個庫是一段 XML-ish 文字；`<書>書名</書>` 標在一部書的開頭，
// 後面接到下一個 `<書>` 之前都算這部書的正文。
package main

import (
	"bytes"
	"compress/bzip2"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strings"
	"unicode/utf16"

	"github.com/accelon/adb-converter/internal/adb"
)

func utf16le(b []byte) string {
	if len(b) >= 2 && b[0] == 0xFF && b[1] == 0xFE {
		b = b[2:]
	}
	u := make([]uint16, 0, len(b)/2)
	for i := 0; i+1 < len(b); i += 2 {
		u = append(u, binary.LittleEndian.Uint16(b[i:]))
	}
	return string(utf16.Decode(u))
}

func decode(src []byte, dst []byte) ([]byte, error) {
	br := bzip2.NewReader(bytes.NewReader(src))
	n := 0
	for {
		m, err := br.Read(dst[n:])
		n += m
		if err == io.EOF {
			if n >= 2 && dst[0] == 0xFF && dst[1] == 0xFE {
				return dst[2:n], nil
			}
			return dst[:n], nil
		}
		if err != nil {
			return nil, err
		}
		if n == len(dst) {
			return nil, io.ErrShortBuffer
		}
	}
}

var booksRe = regexp.MustCompile(`<書(?: ([^>]*))?>([^<]*)</書>`)
var kepanRE = regexp.MustCompile(`[甲乙丙丁戊己庚辛壬癸][一二三四五六七八九十]`)

type book struct {
	title string
	chars int
	marks int
	ke    int
	lvl   int
	keTag int
	snip  string
}

func load(path string) string {
	f, err := os.Open(path)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	outer, err := adb.ParseBlockSet(f, adb.FileHeaderSize)
	if err != nil {
		panic(err)
	}
	src, err := adb.ParseBlockSet(f, outer.OffsetByName("source"))
	if err != nil {
		panic(err)
	}
	dst := make([]byte, 32<<20)
	var sb strings.Builder
	for i := 0; i < src.BlockCount(); i++ {
		b, e := src.BlockRange(i)
		blk, _ := adb.ReadAt(f, b, int(e-b))
		o, err := decode(blk, dst)
		for err == io.ErrShortBuffer {
			dst = make([]byte, len(dst)*2)
			o, err = decode(blk, dst)
		}
		if err != nil {
			panic(err)
		}
		sb.WriteString(utf16le(o))
	}
	return sb.String()
}

func head(s string, n int) string {
	r := []rune(s)
	if len(r) < n {
		n = len(r)
	}
	return string(r[:n])
}

func main() {
	t := load(os.Args[1])
	mode := ""
	if len(os.Args) > 2 {
		mode = os.Args[2]
	}
	switch mode {
	case "head":
		fmt.Println(head(t, 800))
		return
	case "ctx":
		i := strings.Index(t, os.Args[3])
		if i < 0 {
			fmt.Println("not found")
			return
		}
		lo := i - 400
		if lo < 0 {
			lo = 0
		}
		fmt.Println(head(t[lo:], 900))
		return
	}

	locs := booksRe.FindAllStringSubmatchIndex(t, -1)
	books := make([]book, 0, len(locs))
	for k, loc := range locs {
		start := loc[1]
		end := len(t)
		if k+1 < len(locs) {
			end = locs[k+1][0]
		}
		body := t[start:end]
		books = append(books, book{
			title: t[loc[4]:loc[5]],
			chars: len([]rune(body)),
			marks: len(kepanRE.FindAllStringIndex(body, -1)),
			ke:    strings.Count(body, "科判") + strings.Count(body, "科文"),
			lvl:   countLevels(body),
			keTag: strings.Count(body, "<科判"),
			snip:  snippet(body),
		})
	}
	sort.Slice(books, func(i, j int) bool { return books[i].keTag*100+books[i].ke > books[j].keTag*100+books[j].ke })
	fmt.Printf("# books=%d total_marks=%d\n", len(books), len(kepanRE.FindAllStringIndex(t, -1)))
	min := 6
	if v := os.Getenv("MIN"); v != "" {
		fmt.Sscanf(v, "%d", &min)
	}
	for _, b := range books {
		if mode == "kescan" {
		if b.keTag == 0 && b.ke < 8 && !strings.Contains(b.title, "科") {
			continue
		}
		fmt.Printf("%d\t%d\t%s\t%s\n", b.keTag, b.ke, b.title, b.snip)
		continue
	}
	if b.marks < min && b.ke < 2 && b.lvl < 10 {
			continue
		}
		fmt.Printf("%d\t%d\t%d\t%d\t%s\n", b.marks, b.ke, b.lvl, b.chars, b.title)
	}
}





// 天干層級標籤：<甲>…<癸>（有些庫把科判層級直接編成元素）
func countLevels(s string) int {
	n := 0
	for _, c := range "甲乙丙丁戊己庚辛壬癸" {
		n += strings.Count(s, "<"+string(c)+">")
	}
	return n
}





// 取第一個「科判」附近的一段，看它是不是真的科判結構
func snippet(body string) string {
	i := strings.Index(body, "科判")
	if i < 0 {
		return ""
	}
	lo := i - 40
	if lo < 0 {
		lo = 0
	}
	return head(strings.ReplaceAll(body[lo:], "\n", " "), 160)
}



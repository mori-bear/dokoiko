# Hotel Link Test Report

生成日: 2026-03-15

## 概要

| 項目 | 値 |
|---|---|
| destination総数 | 299件 |
| hotelAreas総数 | 330件 |
| 楽天リンク | PASS 299/299 |
| じゃらんリンク | PASS 299/299 |
| Puppeteer E2Eサンプル | PASS 20/20 |

## URL仕様

### 楽天トラベル（検証済み・稼働中）

```
https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query={encodeURIComponent(prefecture + " " + city)}
```

アフィリエイト経由: RAKUTEN_AFF + target

### じゃらん（検証済み・稼働中）

```
https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={Shift-JIS encoded keyword}
```

アフィリエイト経由: VC_BASE + encodeURIComponent(target)

## 代替URL調査結果

| URL | HTTP Status | 判定 |
|---|---|---|
| travel.rakuten.co.jp/searchHotelArea.do?f_query=... | 404 | ❌ 無効 |
| www.jalan.net/yadolist/?keyword=... | 404 | ❌ 無効 |
| kw.travel.rakuten.co.jp/keyword/Search.do?f_query=... | 200 | ✅ 有効 |

## サンプルリンク（先頭10件）

| destination | 楽天URL | じゃらんURL |
|---|---|---|
| 鎌倉 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%20%E9%8E%8C%E5%80%89%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2590%255F%2593%25DE%2590%25EC%258C%25A7%2520%258A%2599%2591%2571%258E%2573) |
| 熱海 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E9%9D%99%E5%B2%A1%E7%9C%8C%20%E7%86%B1%E6%B5%B7%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2590%25C3%2589%25AA%258C%25A7%2520%2594%254D%258A%2543%258E%2573) |
| 日光 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E6%A0%83%E6%9C%A8%E7%9C%8C%20%E6%97%A5%E5%85%89%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2593%25C8%2596%25D8%258C%25A7%2520%2593%25FA%258C%25F5%258E%2573) |
| 軽井沢 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E9%95%B7%E9%87%8E%E7%9C%8C%20%E8%BB%BD%E4%BA%95%E6%B2%A2%E7%94%BA) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2592%25B7%2596%25EC%258C%25A7%2520%258C%2579%2588%25E4%2591%25F2%2592%25AC) |
| 富士河口湖 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E5%B1%B1%E6%A2%A8%E7%9C%8C%20%E5%B1%B1%E6%A2%A8%E5%AF%8C%E5%A3%AB%E6%B2%B3%E5%8F%A3%E6%B9%96) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%258E%2552%2597%259C%258C%25A7%2520%258E%2552%2597%259C%2595%2578%258E%256D%2589%25CD%258C%25FB%258C%25CE) |
| 奈良 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E5%A5%88%E8%89%AF%E7%9C%8C%20%E5%A5%88%E8%89%AF%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2593%25DE%2597%25C7%258C%25A7%2520%2593%25DE%2597%25C7%258E%2573) |
| 石垣島 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E6%B2%96%E7%B8%84%E7%9C%8C%20%E7%9F%B3%E5%9E%A3%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2589%25AB%2593%25EA%258C%25A7%2520%2590%25CE%258A%255F%258E%2573) |
| 伊勢 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E4%B8%89%E9%87%8D%E7%9C%8C%20%E4%BC%8A%E5%8B%A2%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%258E%254F%258F%2564%258C%25A7%2520%2588%25C9%2590%25A8%258E%2573) |
| 別府 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E5%A4%A7%E5%88%86%E7%9C%8C%20%E5%88%A5%E5%BA%9C%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2591%25E5%2595%25AA%258C%25A7%2520%2595%25CA%2595%257B%258E%2573) |
| 小樽 | [楽天](https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=%E5%8C%97%E6%B5%B7%E9%81%93%20%E5%B0%8F%E6%A8%BD%E5%B8%82) | [じゃらん](https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fuw%2Fuwp2011%2Fuww2011init.do%3Fkeyword%3D%2596%256B%258A%2543%2593%25B9%2520%258F%25AC%2592%254D%258E%2573) |
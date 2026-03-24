export const CITY_TO_SHINKANSEN = {
  "大阪": "新大阪",
  "神戸": "新神戸",
  "横浜": "新横浜"
};

export const ROUTES = {
  "otaru": [
    {
      "step": 1,
      "to": "新千歳空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "新千歳空港",
      "to": "小樽",
      "type": "rail",
      "operator": "JR北海道",
      "label": "JR快速エアポート"
    }
  ],
  "furano": [
    {
      "step": 1,
      "to": "旭川空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "旭川",
      "to": "富良野",
      "type": "rail",
      "operator": "JR北海道",
      "label": "JR富良野線"
    }
  ],
  "toyako": [
    {
      "step": 1,
      "to": "新千歳空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "洞爺",
      "to": "洞爺湖温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "noboribetsu": [
    {
      "step": 1,
      "to": "新千歳空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "登別",
      "to": "登別温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "shiretoko": [
    {
      "step": 1,
      "to": "女満別空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "網走",
      "to": "知床",
      "type": "car"
    }
  ],
  "jozankei": [
    {
      "step": 1,
      "to": "新千歳空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "札幌",
      "to": "定山渓",
      "type": "bus",
      "label": "バス"
    }
  ],
  "biei": [
    {
      "step": 1,
      "to": "旭川空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "旭川",
      "to": "美瑛",
      "type": "car"
    }
  ],
  "matsushima": [
    {
      "step": 1,
      "to": "仙台",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "仙台",
      "to": "松島海岸",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR仙石線"
    }
  ],
  "hiraizumi": [
    {
      "step": 1,
      "to": "一ノ関",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "一ノ関",
      "to": "平泉",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR東北本線"
    }
  ],
  "kakunodate": [
    {
      "step": 1,
      "to": "角館",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "秋田新幹線"
    }
  ],
  "aizu": [
    {
      "step": 1,
      "to": "郡山",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "郡山",
      "to": "会津若松",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR磐越西線"
    }
  ],
  "zaosan": [
    {
      "step": 1,
      "to": "山形",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "山形新幹線"
    },
    {
      "step": 2,
      "from": "山形",
      "to": "蔵王温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "akita": [
    {
      "step": 1,
      "to": "秋田",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "秋田新幹線"
    }
  ],
  "sakata": [
    {
      "step": 1,
      "to": "庄内空港",
      "type": "flight",
      "label": "飛行機"
    }
  ],
  "nyuto-onsen": [
    {
      "step": 1,
      "to": "田沢湖",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "秋田新幹線"
    },
    {
      "step": 2,
      "from": "田沢湖",
      "to": "乳頭温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "ginzan-onsen": [
    {
      "step": 1,
      "to": "山形",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "山形新幹線"
    },
    {
      "step": 2,
      "from": "大石田",
      "to": "銀山温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "ouchi-juku": [
    {
      "step": 1,
      "to": "那須塩原",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "那須塩原",
      "to": "大内宿",
      "type": "car"
    }
  ],
  "naruko-onsen": [
    {
      "step": 1,
      "to": "古川",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "古川",
      "to": "鳴子温泉",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR陸羽東線"
    }
  ],
  "hirosaki": [
    {
      "step": 1,
      "to": "新青森",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "新青森",
      "to": "弘前",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR奥羽本線"
    }
  ],
  "oirase": [
    {
      "step": 1,
      "to": "八戸",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "八戸",
      "to": "奥入瀬渓流",
      "type": "car"
    }
  ],
  "osorezan": [
    {
      "step": 1,
      "to": "八戸",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "下北",
      "to": "恐山",
      "type": "bus",
      "label": "バス"
    }
  ],
  "yamadera": [
    {
      "step": 1,
      "to": "山形",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "山形新幹線"
    },
    {
      "step": 2,
      "from": "山形",
      "to": "山寺",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR仙山線"
    }
  ],
  "miyako-iwate": [
    {
      "step": 1,
      "to": "盛岡",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "盛岡",
      "to": "宮古",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR山田線"
    }
  ],
  "kamakura": [
    {
      "step": 1,
      "to": "東京",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "東京",
      "to": "鎌倉",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR横須賀線"
    }
  ],
  "nikko": [
    {
      "step": 1,
      "to": "宇都宮",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "宇都宮",
      "to": "日光",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR日光線"
    }
  ],
  "kouzushima": [
    {
      "step": 1,
      "to": "東京",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "東京",
      "to": "竹芝客船ターミナル",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "竹芝桟橋",
      "to": "神津島港",
      "type": "ferry",
      "ferryUrl": "https://www.tokaikisen.co.jp/",
      "ferryOperator": "東海汽船",
      "noLocalMaps": true
    }
  ],
  "hakone": [
    {
      "step": 1,
      "to": "小田原",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "小田原",
      "to": "箱根湯本",
      "type": "bus",
      "label": "箱根登山鉄道"
    }
  ],
  "kusatsu-onsen": [
    {
      "step": 1,
      "to": "高崎",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "高崎",
      "to": "草津温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "izu-oshima": [
    {
      "step": 1,
      "to": "熱海",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "熱海駅",
      "to": "熱海港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "熱海港",
      "to": "大島",
      "type": "ferry",
      "ferryUrl": "https://www.tokaikisen.co.jp/",
      "ferryOperator": "東海汽船",
      "noLocalMaps": true
    }
  ],
  "takao": [
    {
      "step": 1,
      "to": "高尾",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR中央本線"
    }
  ],
  "tateyama-chiba": [
    {
      "step": 1,
      "to": "館山",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR内房線"
    }
  ],
  "shima-onsen": [
    {
      "step": 1,
      "to": "高崎",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "上越新幹線"
    },
    {
      "step": 2,
      "from": "高崎",
      "to": "四万温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "mashiko": [
    {
      "step": 1,
      "to": "宇都宮",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "東北新幹線"
    },
    {
      "step": 2,
      "from": "宇都宮",
      "to": "益子",
      "type": "car"
    }
  ],
  "minakami-onsen": [
    {
      "step": 1,
      "to": "上毛高原",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "上越新幹線"
    },
    {
      "step": 2,
      "from": "上毛高原",
      "to": "水上温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "ise": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "名古屋",
      "to": "伊勢市",
      "type": "bus",
      "label": "近鉄特急"
    }
  ],
  "okuhida-onsen": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "高山",
      "to": "奥飛騨温泉郷",
      "type": "car"
    }
  ],
  "toba": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "名古屋",
      "to": "鳥羽",
      "type": "bus",
      "label": "近鉄特急"
    }
  ],
  "inuyama": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "名古屋",
      "to": "犬山",
      "type": "bus",
      "label": "名鉄犬山線"
    }
  ],
  "kiso": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "名古屋",
      "to": "木曽福島",
      "type": "rail",
      "operator": "JR東海",
      "label": "JR中央本線"
    }
  ],
  "tsumago": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "名古屋",
      "to": "南木曽",
      "type": "rail",
      "operator": "JR東海",
      "label": "JR中央本線"
    }
  ],
  "magome": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "名古屋",
      "to": "中津川",
      "type": "rail",
      "operator": "JR東海",
      "label": "JR中央本線"
    }
  ],
  "gero-onsen": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "名古屋",
      "to": "下呂",
      "type": "rail",
      "operator": "JR東海",
      "label": "特急ひだ"
    }
  ],
  "kamikochi": [
    {
      "step": 1,
      "to": "名古屋",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "松本",
      "to": "上高地",
      "type": "bus",
      "label": "アルピコバス"
    }
  ],
  "wajima": [
    {
      "step": 1,
      "to": "金沢",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "金沢",
      "to": "輪島",
      "type": "car"
    }
  ],
  "kaga-onsen": [
    {
      "step": 1,
      "to": "加賀温泉",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "北陸新幹線"
    }
  ],
  "gokayama": [
    {
      "step": 1,
      "to": "新高岡",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "新高岡",
      "to": "五箇山",
      "type": "bus",
      "label": "加越能バス"
    }
  ],
  "himi": [
    {
      "step": 1,
      "to": "新高岡",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "新高岡",
      "to": "氷見",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR氷見線"
    }
  ],
  "wakura-onsen": [
    {
      "step": 1,
      "to": "金沢",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "金沢",
      "to": "和倉温泉",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR七尾線 特急能登かがり火"
    }
  ],
  "atami": [
    {
      "step": 1,
      "to": "熱海",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    }
  ],
  "karuizawa": [
    {
      "step": 1,
      "to": "軽井沢",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "北陸新幹線"
    }
  ],
  "fujikawaguchiko": [
    {
      "step": 1,
      "to": "大月",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR中央本線 特急かいじ"
    },
    {
      "step": 2,
      "from": "大月",
      "to": "河口湖",
      "type": "bus",
      "label": "富士急行線"
    }
  ],
  "shuzenji": [
    {
      "step": 1,
      "to": "三島",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "三島",
      "to": "修善寺",
      "type": "bus",
      "label": "伊豆箱根鉄道"
    }
  ],
  "shimoda": [
    {
      "step": 1,
      "to": "熱海",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "熱海",
      "to": "下田",
      "type": "bus",
      "label": "伊豆急行線"
    }
  ],
  "hakuba": [
    {
      "step": 1,
      "to": "長野",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "長野",
      "to": "白馬",
      "type": "rail",
      "operator": "JR東日本",
      "label": "JR大糸線"
    }
  ],
  "tateyama-kurobe": [
    {
      "step": 1,
      "to": "富山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "富山",
      "to": "立山",
      "type": "bus",
      "label": "富山地方鉄道"
    }
  ],
  "obuse": [
    {
      "step": 1,
      "to": "長野",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "長野",
      "to": "小布施",
      "type": "bus",
      "label": "長野電鉄"
    }
  ],
  "nozawa-onsen": [
    {
      "step": 1,
      "to": "飯山",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "飯山",
      "to": "野沢温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "bessho-onsen": [
    {
      "step": 1,
      "to": "上田",
      "type": "shinkansen",
      "operator": "JR東日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "上田",
      "to": "別所温泉",
      "type": "bus",
      "label": "上田電鉄"
    }
  ],
  "nara": [
    {
      "step": 1,
      "to": "新大阪",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "大阪",
      "to": "奈良",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR大和路線"
    }
  ],
  "ryujin-onsen": [
    {
      "step": 1,
      "to": "新大阪",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "紀伊田辺",
      "to": "龍神温泉",
      "type": "car"
    }
  ],
  "arima-onsen": [
    {
      "step": 1,
      "to": "新神戸",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "神戸",
      "to": "有馬温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "kinosaki-onsen": [
    {
      "step": 1,
      "to": "新大阪",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "大阪",
      "to": "城崎温泉",
      "type": "rail",
      "operator": "JR西日本",
      "label": "特急きのさき"
    }
  ],
  "shirahama-o": [
    {
      "step": 1,
      "to": "新大阪",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "大阪",
      "to": "白浜",
      "type": "rail",
      "operator": "JR西日本",
      "label": "特急くろしお"
    }
  ],
  "amanohashidate": [
    {
      "step": 1,
      "to": "新大阪",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "大阪",
      "to": "天橋立",
      "type": "rail",
      "operator": "JR西日本",
      "label": "特急はしだて"
    }
  ],
  "awaji": [
    {
      "step": 1,
      "to": "新神戸",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "神戸",
      "to": "淡路島",
      "type": "bus",
      "label": "高速バス"
    }
  ],
  "nagahama": [
    {
      "step": 1,
      "to": "米原",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "米原",
      "to": "長浜",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR北陸本線"
    }
  ],
  "hikone": [
    {
      "step": 1,
      "to": "米原",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "米原",
      "to": "彦根",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR琵琶湖線"
    }
  ],
  "koyasan": [
    {
      "step": 1,
      "to": "新大阪",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "大阪",
      "to": "高野山",
      "type": "bus",
      "label": "南海高野線＋ケーブル"
    }
  ],
  "izushi": [
    {
      "step": 1,
      "to": "豊岡",
      "type": "rail",
      "operator": "JR西日本",
      "label": "特急きのさき"
    },
    {
      "step": 2,
      "from": "豊岡",
      "to": "出石",
      "type": "car"
    }
  ],
  "ine": [
    {
      "step": 1,
      "to": "新大阪",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "天橋立",
      "to": "伊根",
      "type": "bus",
      "label": "バス"
    }
  ],
  "miyama": [
    {
      "step": 1,
      "to": "京都",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "京都",
      "to": "美山",
      "type": "bus",
      "label": "高速バス"
    }
  ],
  "miyajima": [
    {
      "step": 1,
      "to": "広島",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "広島",
      "to": "宮島口",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR山陽本線"
    },
    {
      "step": 3,
      "from": "宮島口",
      "to": "宮島",
      "type": "ferry",
      "ferryUrl": "https://miyajima-matsudai.co.jp/",
      "ferryOperator": "宮島松大フェリー",
      "noLocalMaps": true
    }
  ],
  "onomichi": [
    {
      "step": 1,
      "to": "福山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "福山",
      "to": "尾道",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR山陽本線"
    }
  ],
  "mihonoseki": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "松江",
      "to": "美保関",
      "type": "car"
    }
  ],
  "hagi": [
    {
      "step": 1,
      "to": "新山口",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "新山口",
      "to": "萩",
      "type": "bus",
      "label": "バス"
    }
  ],
  "akiyoshidai": [
    {
      "step": 1,
      "to": "新山口",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "新山口",
      "to": "秋吉台",
      "type": "bus",
      "label": "バス"
    }
  ],
  "shimonoseki": [
    {
      "step": 1,
      "to": "小倉",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "小倉",
      "to": "下関",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR山陽本線"
    }
  ],
  "tottori": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "鳥取",
      "type": "rail",
      "operator": "JR西日本",
      "label": "特急スーパーいなば"
    }
  ],
  "tsuwano": [
    {
      "step": 1,
      "to": "新山口",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "新山口",
      "to": "津和野",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR山口線"
    }
  ],
  "yuda-onsen": [
    {
      "step": 1,
      "to": "新山口",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "新山口",
      "to": "湯田温泉",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR山口線"
    }
  ],
  "oku-izumo": [
    {
      "step": 1,
      "to": "出雲縁結び空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "出雲市",
      "to": "奥出雲",
      "type": "car"
    }
  ],
  "takehara": [
    {
      "step": 1,
      "to": "広島",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "広島",
      "to": "竹原",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR呉線"
    }
  ],
  "misasa-onsen": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "倉吉",
      "to": "三朝温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "uwajima": [
    {
      "step": 1,
      "to": "松山空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "松山",
      "to": "宇和島",
      "type": "rail",
      "operator": "JR四国",
      "label": "特急宇和海"
    }
  ],
  "uchiko": [
    {
      "step": 1,
      "to": "松山空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "松山",
      "to": "内子",
      "type": "rail",
      "operator": "JR四国",
      "label": "JR予讃線"
    }
  ],
  "ashizuri": [
    {
      "step": 1,
      "to": "高知空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "高知",
      "to": "足摺岬",
      "type": "car"
    }
  ],
  "muroto": [
    {
      "step": 1,
      "to": "高知空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "高知",
      "to": "室戸岬",
      "type": "car"
    }
  ],
  "shodoshima": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "高松港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "高松港",
      "to": "小豆島",
      "type": "ferry",
      "ferryUrl": "https://www.shoudoshima-ferry.co.jp/",
      "ferryOperator": "小豆島フェリー",
      "noLocalMaps": true
    }
  ],
  "naoshima": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "宇野港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "宇野港",
      "to": "直島",
      "type": "ferry",
      "ferryUrl": "https://ferry.co.jp/",
      "ferryOperator": "四国汽船",
      "noLocalMaps": true
    }
  ],
  "kotohira": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "琴平",
      "type": "rail",
      "operator": "JR四国",
      "label": "特急南風"
    }
  ],
  "oboke": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "大歩危",
      "type": "rail",
      "operator": "JR四国",
      "label": "特急南風"
    }
  ],
  "iya": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "阿波池田",
      "to": "祖谷",
      "type": "car"
    }
  ],
  "ishigaki": [
    {
      "step": 1,
      "to": "石垣空港",
      "type": "flight",
      "label": "飛行機"
    }
  ],
  "tokashiki-jima": [
    {
      "step": 1,
      "to": "那覇空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "那覇空港",
      "to": "那覇港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "那覇港",
      "to": "渡嘉敷島",
      "type": "ferry",
      "ferryUrl": "https://vill.tokashiki.okinawa.jp/",
      "ferryOperator": "渡嘉敷村営フェリー",
      "noLocalMaps": true
    }
  ],
  "kumejima": [
    {
      "step": 1,
      "to": "久米島空港",
      "type": "flight",
      "label": "飛行機"
    }
  ],
  "miyakojima": [
    {
      "step": 1,
      "to": "宮古空港",
      "type": "flight",
      "label": "飛行機"
    }
  ],
  "yufuin": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "博多",
      "to": "由布院",
      "type": "rail",
      "operator": "JR九州",
      "label": "特急ゆふいんの森"
    }
  ],
  "aso": [
    {
      "step": 1,
      "to": "熊本",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "九州新幹線"
    },
    {
      "step": 2,
      "from": "熊本",
      "to": "阿蘇",
      "type": "rail",
      "operator": "JR九州",
      "label": "JR豊肥本線"
    }
  ],
  "takachiho": [
    {
      "step": 1,
      "to": "熊本",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "九州新幹線"
    },
    {
      "step": 2,
      "from": "熊本",
      "to": "高千穂",
      "type": "bus",
      "label": "バス"
    }
  ],
  "hitoyoshi": [
    {
      "step": 1,
      "to": "熊本",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "九州新幹線"
    },
    {
      "step": 2,
      "from": "熊本",
      "to": "人吉",
      "type": "rail",
      "operator": "JR九州",
      "label": "JR肥薩線"
    }
  ],
  "minami-aso": [
    {
      "step": 1,
      "to": "熊本",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "九州新幹線"
    },
    {
      "step": 2,
      "from": "熊本",
      "to": "南阿蘇",
      "type": "car"
    }
  ],
  "sasebo": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "博多",
      "to": "佐世保",
      "type": "rail",
      "operator": "JR九州",
      "label": "特急みどり"
    }
  ],
  "hirado": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "佐世保",
      "to": "平戸",
      "type": "car"
    }
  ],
  "goto": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "博多駅",
      "to": "博多港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "博多港",
      "to": "五島",
      "type": "ferry",
      "ferryUrl": "https://www.kyusho.co.jp/",
      "ferryOperator": "九州商船",
      "noLocalMaps": true
    }
  ],
  "unzen": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "諫早",
      "to": "雲仙温泉",
      "type": "bus",
      "label": "バス"
    }
  ],
  "ureshino-onsen": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "武雄温泉",
      "to": "嬉野温泉",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "西九州新幹線"
    }
  ],
  "yakushima": [
    {
      "step": 1,
      "to": "鹿児島空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "鹿児島空港",
      "to": "鹿児島港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "鹿児島港",
      "to": "屋久島",
      "type": "ferry",
      "ferryUrl": "https://www.tykousoku.jp/",
      "ferryOperator": "種子屋久高速船",
      "noLocalMaps": true
    }
  ],
  "ibusuki": [
    {
      "step": 1,
      "to": "鹿児島中央",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "九州新幹線"
    },
    {
      "step": 2,
      "from": "鹿児島中央",
      "to": "指宿",
      "type": "rail",
      "operator": "JR九州",
      "label": "指宿のたまて箱"
    }
  ],
  "amami": [
    {
      "step": 1,
      "to": "奄美空港",
      "type": "flight",
      "label": "飛行機"
    }
  ],
  "obi": [
    {
      "step": 1,
      "to": "宮崎空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "宮崎",
      "to": "飫肥",
      "type": "rail",
      "operator": "JR九州",
      "label": "JR日南線"
    }
  ],
  "kirishima": [
    {
      "step": 1,
      "to": "鹿児島中央",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "九州新幹線"
    },
    {
      "step": 2,
      "from": "鹿児島中央",
      "to": "霧島温泉",
      "type": "car"
    }
  ],
  "beppu": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "博多",
      "to": "別府",
      "type": "rail",
      "operator": "JR九州",
      "label": "特急ソニック"
    }
  ],
  "amakusa": [
    {
      "step": 1,
      "to": "熊本",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "九州新幹線"
    },
    {
      "step": 2,
      "from": "熊本",
      "to": "天草",
      "type": "car"
    }
  ],
  "tenryu-gorge": [
    {
      "step": 1,
      "to": "浜松",
      "type": "shinkansen",
      "operator": "JR東海",
      "label": "東海道新幹線"
    },
    {
      "step": 2,
      "from": "浜松",
      "to": "天竜峡",
      "type": "car"
    }
  ],
  "shikoku-karst": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "松山",
      "type": "rail",
      "operator": "JR四国",
      "label": "特急しおかぜ"
    },
    {
      "step": 3,
      "from": "松山",
      "to": "四国カルスト",
      "type": "car"
    }
  ],
  "shikoku-karst@高松": [
    {
      "step": 1,
      "to": "松山",
      "type": "rail",
      "operator": "JR四国",
      "label": "特急いしづち"
    },
    {
      "step": 2,
      "from": "松山",
      "to": "四国カルスト",
      "type": "car"
    }
  ],
  "shikoku-karst@松山": [
    {
      "step": 1,
      "from": "松山",
      "to": "四国カルスト",
      "type": "car"
    }
  ],
  "shikoku-karst@高知": [
    {
      "step": 1,
      "to": "松山",
      "type": "rail",
      "operator": "JR四国",
      "label": "特急あしずり・宿毛線経由"
    },
    {
      "step": 2,
      "from": "松山",
      "to": "四国カルスト",
      "type": "car"
    }
  ],
  "zamami-island": [
    {
      "step": 1,
      "to": "那覇空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "那覇空港",
      "to": "泊港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "泊港",
      "to": "座間味島",
      "type": "ferry",
      "ferryUrl": "https://vill.zamami.okinawa.jp/",
      "ferryOperator": "フェリーざまみ",
      "noLocalMaps": true
    }
  ],
  "iki-island": [
    {
      "step": 1,
      "to": "博多",
      "type": "shinkansen",
      "operator": "JR九州",
      "label": "山陽・九州新幹線"
    },
    {
      "step": 2,
      "from": "博多駅",
      "to": "博多港",
      "type": "localMove",
      "label": "Googleマップ"
    },
    {
      "step": 3,
      "from": "博多港",
      "to": "壱岐",
      "type": "ferry",
      "ferryUrl": "https://www.kyu-you.co.jp/",
      "ferryOperator": "九州郵船",
      "noLocalMaps": true
    }
  ],
  "suzu": [
    {
      "step": 1,
      "to": "金沢",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "北陸新幹線"
    },
    {
      "step": 2,
      "from": "金沢",
      "to": "珠洲",
      "type": "car"
    }
  ],
  "tsuyama": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "津山",
      "type": "rail",
      "operator": "JR西日本",
      "label": "JR津山線"
    }
  ],
  "ushimado": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "牛窓",
      "type": "car"
    }
  ],
  "onna": [
    {
      "step": 1,
      "to": "那覇空港",
      "type": "flight",
      "label": "飛行機"
    },
    {
      "step": 2,
      "from": "那覇空港",
      "to": "恩納村",
      "type": "localMove",
      "label": "Googleマップ"
    }
  ],
  "yunotsu-onsen": [
    {
      "step": 1,
      "to": "岡山",
      "type": "shinkansen",
      "operator": "JR西日本",
      "label": "山陽新幹線"
    },
    {
      "step": 2,
      "from": "岡山",
      "to": "出雲市",
      "type": "rail",
      "operator": "JR西日本",
      "label": "特急やくも"
    },
    {
      "step": 3,
      "from": "出雲市",
      "to": "温泉津",
      "type": "car"
    }
  ]
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hubsFile = path.join(__dirname, '../src/data/hubs.json');
const data = JSON.parse(fs.readFileSync(hubsFile, 'utf8'));

// 正規アフィリエイトID: sid=3764408 / pid=892559858 / rakuten=5113ee4b.8662cfc5.5113ee4c.119de89a
const naha = data.find(d => d.id === 'naha');
if (naha) {
  naha.hotelLinks = {
    rakuten: 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=https%3A%2F%2Ftravel.rakuten.co.jp%2Fyad%2Fsearch%2FareaSearchMain.do%3Ff_area%3D471%26f_keyword%3D%E9%82%A3%E8%A6%87',
    jalan:   'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=https%3A%2F%2Fwww.jalan.net%2Fken%2Fjapan%2F471000%2F',
  };
  console.log('✅ 那覇 hotelLinks 追加完了 (hubs.json)');
} else {
  console.error('❌ naha エントリが hubs.json に見つかりません');
}

fs.writeFileSync(hubsFile, JSON.stringify(data, null, 2), 'utf8');

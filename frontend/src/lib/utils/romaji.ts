// 日本語からローマ字への変換ユーティリティ

const hiraganaToRomaji: { [key: string]: string } = {
	あ: 'a',
	い: 'i',
	う: 'u',
	え: 'e',
	お: 'o',
	か: 'ka',
	き: 'ki',
	く: 'ku',
	け: 'ke',
	こ: 'ko',
	が: 'ga',
	ぎ: 'gi',
	ぐ: 'gu',
	げ: 'ge',
	ご: 'go',
	さ: 'sa',
	し: 'shi',
	す: 'su',
	せ: 'se',
	そ: 'so',
	ざ: 'za',
	じ: 'ji',
	ず: 'zu',
	ぜ: 'ze',
	ぞ: 'zo',
	た: 'ta',
	ち: 'chi',
	つ: 'tsu',
	て: 'te',
	と: 'to',
	だ: 'da',
	ぢ: 'di',
	づ: 'du',
	で: 'de',
	ど: 'do',
	な: 'na',
	に: 'ni',
	ぬ: 'nu',
	ね: 'ne',
	の: 'no',
	は: 'ha',
	ひ: 'hi',
	ふ: 'fu',
	へ: 'he',
	ほ: 'ho',
	ば: 'ba',
	び: 'bi',
	ぶ: 'bu',
	べ: 'be',
	ぼ: 'bo',
	ぱ: 'pa',
	ぴ: 'pi',
	ぷ: 'pu',
	ぺ: 'pe',
	ぽ: 'po',
	ま: 'ma',
	み: 'mi',
	む: 'mu',
	め: 'me',
	も: 'mo',
	や: 'ya',
	ゆ: 'yu',
	よ: 'yo',
	ら: 'ra',
	り: 'ri',
	る: 'ru',
	れ: 're',
	ろ: 'ro',
	わ: 'wa',
	を: 'wo',
	ん: 'n',
	きゃ: 'kya',
	きゅ: 'kyu',
	きょ: 'kyo',
	しゃ: 'sha',
	しゅ: 'shu',
	しょ: 'sho',
	ちゃ: 'cha',
	ちゅ: 'chu',
	ちょ: 'cho',
	にゃ: 'nya',
	にゅ: 'nyu',
	にょ: 'nyo',
	ひゃ: 'hya',
	ひゅ: 'hyu',
	ひょ: 'hyo',
	みゃ: 'mya',
	みゅ: 'myu',
	みょ: 'myo',
	りゃ: 'rya',
	りゅ: 'ryu',
	りょ: 'ryo',
	ぎゃ: 'gya',
	ぎゅ: 'gyu',
	ぎょ: 'gyo',
	じゃ: 'ja',
	じゅ: 'ju',
	じょ: 'jo',
	びゃ: 'bya',
	びゅ: 'byu',
	びょ: 'byo',
	ぴゃ: 'pya',
	ぴゅ: 'pyu',
	ぴょ: 'pyo',
	っ: '', // 促音は次の子音を重ねる
	ー: '', // 長音記号
}

// よくある漢字名前のひらがな読み（基本的なもののみ）
const kanjiReadings: { [key: string]: string } = {
	// 姓
	田中: 'たなか',
	山田: 'やまだ',
	佐藤: 'さとう',
	鈴木: 'すずき',
	高橋: 'たかはし',
	伊藤: 'いとう',
	渡辺: 'わたなべ',
	中村: 'なかむら',
	小林: 'こばやし',
	加藤: 'かとう',
	吉田: 'よしだ',
	山本: 'やまもと',
	松本: 'まつもと',
	井上: 'いのうえ',
	木村: 'きむら',
	林: 'はやし',
	森: 'もり',
	清水: 'しみず',
	山崎: 'やまざき',
	池田: 'いけだ',
	// 名
	太郎: 'たろう',
	次郎: 'じろう',
	三郎: 'さぶろう',
	花子: 'はなこ',
	愛: 'あい',
	恵: 'めぐみ',
	翔: 'しょう',
	蓮: 'れん',
	結愛: 'ゆあ',
	陽菜: 'ひな',
	咲良: 'さくら',
	美咲: 'みさき',
	健太: 'けんた',
	大輔: 'だいすけ',
	裕太: 'ゆうた',
}

function katakanaToHiragana(str: string): string {
	return str.replace(/[\u30A1-\u30F6]/g, (match) => {
		const chr = match.charCodeAt(0) - 0x60
		return String.fromCharCode(chr)
	})
}

export function toRomaji(text: string): string {
	if (!text)
		return ''

	// まず漢字の読みがあるかチェック
	if (kanjiReadings[text]) {
		return convertHiraganaToRomaji(kanjiReadings[text])
	}

	// カタカナをひらがなに変換
	const hiragana = katakanaToHiragana(text)

	return convertHiraganaToRomaji(hiragana)
}

// ひらがなをローマ字に変換する内部関数
function convertHiraganaToRomaji(hiragana: string): string {
	let result = ''
	let i = 0

	while (i < hiragana.length) {
		// 2文字の組み合わせをチェック（きゃ、しゃなど）
		if (i < hiragana.length - 1) {
			const twoChar = hiragana.slice(i, i + 2)
			if (hiraganaToRomaji[twoChar]) {
				result += hiraganaToRomaji[twoChar]
				i += 2
				continue
			}
		}

		// 促音の処理
		if (hiragana[i] === 'っ' && i < hiragana.length - 1) {
			const nextChar = hiragana[i + 1]
			const nextRomaji = hiraganaToRomaji[nextChar]
			if (nextRomaji) {
				result += nextRomaji[0] // 次の子音を重ねる
			}
			i++
			continue
		}

		// 1文字の変換
		const char = hiragana[i]
		if (hiraganaToRomaji[char]) {
			result += hiraganaToRomaji[char]
		} else if (/[ぁ-んァ-ヶー]/.test(char)) {
			// ひらがな・カタカナだが変換テーブルにない場合はスキップ
		} else {
			// 漢字やその他の変換できない文字はスキップ（そのままローマ字フィールドに入れない）
			// 変換できない文字は静かに無視する（ログ出力しない）
		}
		i++
	}

	// デフォルトは小文字で返す
	return result.toLowerCase()
}

// 最初の文字を大文字にする版
export function toRomajiCapitalized(text: string): string {
	const result = toRomaji(text)
	return result.charAt(0).toUpperCase() + result.slice(1)
}

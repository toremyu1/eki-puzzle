// types.d.ts
// このファイルは型の定義だけを行うための専用ファイルです。
// 実際の処理は持たず、VS Codeがコードを検査するための辞書として機能します。

interface Station {
  kanji: string;
  yomi: string;
  
  // ? をつけると、「このデータは存在しない（undefined）場合もある」という意味になります
  pref?: string;
  companies?: string[];
  address?: string;
  min_km?: number;
  is_abolished_confirmed?: boolean;
  startDay?: number;
  endDay?: number;
  url?: string;
  population?: number;
}
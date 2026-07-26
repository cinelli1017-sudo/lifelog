import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

// GitHub Pagesで公開しているlife-logの本番オリジンのみ許可する(APIキーの乱用防止)
const ALLOWED_ORIGIN = "https://cinelli1017-sudo.github.io";

const MOOD_LABELS = {
  great: "最高",
  good: "良い",
  normal: "普通",
  bad: "微妙",
  worst: "最悪",
};

const SYSTEM_PROMPT = `あなたはユーザーの日々の気持ちに寄り添う、優しく共感してくれる友人です。
月曜日から日曜日までの1週間分の記録を読んで、その1週間を振り返るコメントを書いてください。

## コメントのルール
- 3〜5文程度の、日々の一言コメントより少し長めの振り返り
- 気分の傾向、よく出てきた活動、印象的だった記録などがあれば触れる
- 優しく共感するトーン。友人が1週間の話をまとめて聞いて労ってくれるような口調
- 説教くさい助言や評価はしない。まずは1週間頑張った気持ちに寄り添う
- 記録が1〜2件しかない週でも、その内容から自然に一言をひねり出す
- 絵文字は使わず、自然な日本語の文章のみで書く
`;

const OUTPUT_SCHEMA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      comment: { type: "string" },
    },
    required: ["comment"],
    additionalProperties: false,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POSTのみ対応しています" });
    return;
  }

  const { entries, weekLabel } = req.body ?? {};
  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: "記録がありません" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "サーバーにANTHROPIC_API_KEYが設定されていません" });
    return;
  }

  const client = new Anthropic();

  const entriesText = entries
    .map((entry) => {
      const mood = MOOD_LABELS[entry.mood] || entry.mood || "(不明)";
      const activities =
        Array.isArray(entry.activities) && entry.activities.length > 0
          ? entry.activities.join("、")
          : "特になし";
      const memo = entry.memo && String(entry.memo).trim() ? String(entry.memo).trim() : "(なし)";
      return `${entry.date || "?"} 気分:${mood} やったこと:${activities} メモ:${memo}`;
    })
    .join("\n");

  const userPrompt = `${weekLabel || "今週"}の記録です。

${entriesText}

上記の1週間を振り返って、コメントをください。`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      output_config: { format: OUTPUT_SCHEMA },
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock) {
      res.status(502).json({ error: "AIから有効な応答が得られませんでした" });
      return;
    }

    const { comment } = JSON.parse(textBlock.text);
    res.status(200).json({ comment });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({ error: "APIキーが無効です。Vercelの環境変数を確認してください" });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "リクエストが多すぎます。少し時間を置いて再試行してください" });
    } else if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: `AI APIエラー: ${err.message}` });
    } else {
      res.status(500).json({ error: err.message || "不明なエラーが発生しました" });
    }
  }
}

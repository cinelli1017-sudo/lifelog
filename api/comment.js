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
ユーザーが書いた今日の記録(気分・やったこと・メモ)を読んで、
その内容に対する一言コメントを返してください。

## コメントのルール
- 1〜2文程度の短い一言(長くても60文字程度)
- 優しく共感するトーン。友人が隣で話を聞いているような口調
- 説教くさい助言や評価はしない。まずは気持ちに寄り添う
- 「メモ」が空欄の場合は、気分とやったことだけから一言添える
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

  const { mood, activities, memo } = req.body ?? {};
  if (!mood || typeof mood !== "string") {
    res.status(400).json({ error: "気分の情報がありません" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "サーバーにANTHROPIC_API_KEYが設定されていません" });
    return;
  }

  const client = new Anthropic();

  const activitiesText =
    Array.isArray(activities) && activities.length > 0 ? activities.join("、") : "特になし";
  const userPrompt = `気分: ${MOOD_LABELS[mood] || mood}
やったこと: ${activitiesText}
メモ: ${memo && String(memo).trim() ? String(memo).trim() : "(なし)"}

上記の今日の記録に対して、一言コメントをください。`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
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

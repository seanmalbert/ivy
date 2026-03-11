import Anthropic from "@anthropic-ai/sdk";
import { READING_LEVEL_GRADES } from "@ivy/shared";

const anthropic = new Anthropic();

export async function explainText(
  text: string,
  context: string,
  readingLevel?: string
): Promise<string> {
  const grade = READING_LEVEL_GRADES[readingLevel ?? "middle-school"] ?? 7;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: `You are Ivy, a friendly assistant that explains things simply. Write at a grade ${grade} reading level. Be concise (2-4 sentences). If the text contains jargon, define it. If it's a legal or government term, explain what it means for everyday life.`,
    messages: [
      {
        role: "user",
        content: context
          ? `The user highlighted this text on a web page: "${text}"\n\nSurrounding context: "${context.slice(0, 500)}"\n\nPlease explain what this means in simple terms.`
          : `Please explain this in simple terms: "${text}"`,
      },
    ],
  });

  return message.content[0].type === "text"
    ? message.content[0].text
    : "Sorry, I couldn't generate an explanation. Please try again.";
}

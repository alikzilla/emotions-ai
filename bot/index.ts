import dotenv from "dotenv";
import { Telegraf, Markup, Context } from "telegraf";
import { message } from "telegraf/filters";
import LocalSession from "telegraf-session-local";

dotenv.config();

// Define interfaces for our custom session and context
interface Order {
  id: string;
  date: string;
  status: string;
  bouquet: string;
}

interface UserOrders {
  [userId: number]: Order[];
}

interface CustomSession {
  lastMessageId?: number;
}

interface CustomContext extends Context {
  session: CustomSession;
}

// Initialize bot with custom context type
const bot = new Telegraf<CustomContext>(process.env.TELEGRAM_BOT_TOKEN!);

// Use local session middleware with proper typing
const localSession = new LocalSession<CustomSession>({
  database: "session_db.json",
});
bot.use(localSession.middleware());

// Store user orders (in-memory for this example)
const userOrders: UserOrders = {};

// Helper function to update messages with proper typing
async function updateMessage(
  ctx: CustomContext,
  text: string,
  extra: Parameters<typeof ctx.reply>[1]
): Promise<void> {
  try {
    if (ctx.session.lastMessageId) {
      await ctx.deleteMessage(ctx.session.lastMessageId).catch(() => {});
    }
    const newMessage = await ctx.reply(text, extra);
    ctx.session.lastMessageId = newMessage.message_id;
  } catch (error) {
    console.error("Error updating message:", error);
  }
}

// Start command handler
bot.start(async (ctx) => {
  ctx.session ??= {};
  await updateMessage(
    ctx,
    `🌸 Welcome to EmotionsAI! 🌸\n\n` +
      `I can help you create a personalized bouquet based on your photos and emotions.\n\n` +
      `What would you like to do?`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🎀 Order a bouquet", "order")],
      [Markup.button.callback("📦 My orders", "orders")],
      [Markup.button.callback("ℹ️ Bot info", "info")],
    ])
  );
});

// Order flow handler
bot.action("order", async (ctx) => {
  await updateMessage(
    ctx,
    `✨ Let's create your perfect bouquet! ✨\n\n` +
      `Please send me a photo that represents the emotion or occasion for your bouquet.\n\n` +
      `For example, you could send:\n` +
      `- A photo of the person you're gifting\n` +
      `- A photo from a special memory\n` +
      `- A landscape with colors you love`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Back to main menu", "back")],
    ])
  );
});

// Photo handler
bot.on(message("photo"), async (ctx) => {
  await updateMessage(
    ctx,
    `🌷 Thank you for your photo! 🌷\n\n` +
      `Our AI is analyzing the colors and emotions to create your perfect bouquet.\n\n` +
      `*Sample Response*: Based on your photo, I recommend a bouquet with:\n` +
      `- Pink roses (for love and appreciation)\n` +
      `- White lilies (for purity and joy)\n` +
      `- Baby's breath (for delicate beauty)\n\n` +
      `Would you like to proceed with this arrangement?`,
    {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("✅ Yes, proceed to checkout", "checkout")],
        [Markup.button.callback("🔄 Try another photo", "order")],
        [Markup.button.callback("⬅️ Back to main menu", "back")],
      ]),
      parse_mode: "Markdown" as const,
    }
  );
});

// Checkout handler
bot.action("checkout", async (ctx) => {
  if (!ctx.from) return;

  const orderId = "EMO-" + Math.floor(1000 + Math.random() * 9000);
  const userId = ctx.from.id;

  userOrders[userId] = userOrders[userId] || [];
  userOrders[userId].push({
    id: orderId,
    date: new Date().toLocaleDateString(),
    status: "Processing",
    bouquet: "Custom AI Bouquet",
  });

  await updateMessage(
    ctx,
    `💐 Order #${orderId} Received! 💐\n\n` +
      `Your custom bouquet is being prepared with care.\n\n` +
      `*Order Details:*\n` +
      `- Bouquet: Custom AI Bouquet\n` +
      `- Status: Processing\n` +
      `- Estimated Delivery: 3-5 business days\n\n` +
      `We'll notify you when your order ships!`,
    {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📦 View my orders", "orders")],
        [Markup.button.callback("⬅️ Back to main menu", "back")],
      ]),
      parse_mode: "Markdown" as const,
    }
  );
});

// Orders handler
bot.action("orders", async (ctx) => {
  if (!ctx.from) return;

  const userId = ctx.from.id;
  const orders = userOrders[userId] || [];

  if (orders.length === 0) {
    await updateMessage(
      ctx,
      `You don't have any orders yet. Would you like to create your first bouquet?`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🎀 Order a bouquet", "order")],
        [Markup.button.callback("⬅️ Back to main menu", "back")],
      ])
    );
    return;
  }

  let message = `📦 Your Orders:\n\n`;
  orders.forEach((order) => {
    message +=
      `*Order #${order.id}*\n` +
      `- Date: ${order.date}\n` +
      `- Bouquet: ${order.bouquet}\n` +
      `- Status: ${order.status}\n\n`;
  });

  await updateMessage(ctx, message, {
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🎀 Order another bouquet", "order")],
      [Markup.button.callback("⬅️ Back to main menu", "back")],
    ]),
    parse_mode: "Markdown" as const,
  });
});

// Info handler
bot.action("info", async (ctx) => {
  await updateMessage(
    ctx,
    `ℹ️ *About EmotionsAI* ℹ️\n\n` +
      `We combine artificial intelligence with floral design to create personalized bouquets based on your photos.\n\n` +
      `*How it works:*\n` +
      `1. Send us a photo\n` +
      `2. Our AI analyzes colors and emotions\n` +
      `3. We design a custom bouquet\n` +
      `4. Your flowers are delivered fresh\n\n` +
      `Perfect for gifts, celebrations, or just to brighten someone's day!`,
    {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🎀 Try it now", "order")],
        [Markup.button.callback("⬅️ Back to main menu", "back")],
      ]),
      parse_mode: "Markdown" as const,
    }
  );
});

// Back to main menu handler
bot.action("back", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage().catch(() => {});
  ctx.session.lastMessageId = undefined;

  if (!ctx.chat) return;

  const newMessage = await ctx.telegram.sendMessage(
    ctx.chat.id,
    `🌸 Welcome to EmotionsAI! 🌸\n\n` + `What would you like to do?`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🎀 Order a bouquet", "order")],
      [Markup.button.callback("📦 My orders", "orders")],
      [Markup.button.callback("ℹ️ Bot info", "info")],
    ])
  );

  ctx.session.lastMessageId = newMessage.message_id;
});

// Error handling
bot.catch((err: unknown, ctx: CustomContext) => {
  const error = err as Error;
  console.error(`Error for ${ctx.updateType}:`, error);
  ctx.reply("An error occurred. Please try again later.");
});

// Start the bot
bot.launch().then(() => {
  console.log("EmotionsAI bot is running...");
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

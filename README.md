# Helios<sup>beta</sup>

[Helios](https://heliosch.at) is a blazing fast, privacy-first LLM chat client built for the T3 Chat Cloneathon. It is fully open source and designed to be a clean, modern alternative to proprietary chat clients, with a focus on user privacy and flexibility.

## Features

- **100% Client-Side**: All chat logic and data storage happens in your browser. No server ever sees your messages or settings.
- **End-to-End Encrypted Sync**: Sync your chat history and settings across devices with client-side encryption. The sync server never sees your data, and you don't need to register or provide an email—just use a passphrase.
- **Bring Your Own Key (BYOK)**: Compatible with every OpenAI API-compatible provider. Use your own API keys for maximum flexibility.
- **Temporary Chats**: Start quick, disposable conversations without saving anything.
- **Web Search Support**: Integrate web search into your chats.
- **Message Editing, Thread Pinning & Branching**: Edit messages, pin important threads, and branch conversations for better organization.
- **Fast & Clean UI**: Built with SvelteKit for a snappy, modern user experience.

## Getting Started

1. **Clone the repository**

   ```sh
   git clone https://github.com/helioschat/helios.git
   cd helios
   ```

2. **Install dependencies**

   ```sh
   bun install
   ```

3. **Run the development server**

   ```sh
   bun run dev
   ```

4. **Open [http://localhost:5173](http://localhost:5173) in your browser**

## Competition

Helios was created in 10 days for the **T3 Chat Cloneathon**, an open source competition to build the best clone of the T3 Chat product.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

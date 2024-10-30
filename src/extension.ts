import * as vscode from "vscode";
import { workspace } from "vscode";
import {
  LanguageClient,
  ServerOptions,
  LanguageClientOptions,
  TransportKind,
  SemanticTokensRequest,
  SemanticTokensDeltaRequest,
} from "vscode-languageclient/node";

export async function activate(context: vscode.ExtensionContext) {
  const outChannel = vscode.window.createOutputChannel("Firestore Rules LSP");

  const startServerCommand = context.asAbsolutePath("server");

  const serverOptions: ServerOptions = {
    command: startServerCommand,
    transport: {
      kind: TransportKind.socket,
      port: 1234,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "firestore-rules" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.rules"),
    },
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    "firestore-language-server-client",
    "Firestore LSP Client",
    serverOptions,
    clientOptions
  );

  try {
    outChannel.appendLine("Starting server");
    await client.start().then(
      () => {
        outChannel.appendLine("Server started");
      },
      (reason) => {
        outChannel.appendLine(`Server died: ${reason}`);
      }
    );
  } catch (e) {
    let err: string = "";

    if (typeof e === "string") {
      err = e.toUpperCase(); // works, `e` narrowed to string
    } else if (e instanceof Error) {
      err = e.message; // works, `e` narrowed to Error
    }

    outChannel.append(`Server died: ${err}`);

    return;
  }

  const semanticTokensProvider =
    client.initializeResult?.capabilities.semanticTokensProvider;

  outChannel.appendLine(
    `Registering a semantic tokens provider with lsp's legend`
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      clientOptions.documentSelector!,
      new FRRulesSemanticTokensProvider(client, outChannel),
      semanticTokensProvider?.legend!
    )
  );
}

class FRRulesSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  private client: LanguageClient;
  private outChannel: vscode.OutputChannel;

  constructor(client: LanguageClient, outChannel: vscode.OutputChannel) {
    this.client = client;
    this.outChannel = outChannel;
  }

  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    let result = await this.client.sendRequest(SemanticTokensRequest.type, {
      textDocument: {
        uri: document.uri.toString(),
      },
    });

    if (!result) {
      return { resultId: undefined, data: new Uint32Array() };
    }

    const u32IntResult = {
      resultId: result.resultId,
      data: new Uint32Array(result.data),
    };

    return u32IntResult;
  }
}

export function deactivate() {}

function* chunks(arr: number[], n: number) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

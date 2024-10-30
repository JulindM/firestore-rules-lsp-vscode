import { SocketTransport } from "./../node_modules/vscode-jsonrpc/lib/node/main.d";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { workspace } from "vscode";
import {
  LanguageClient,
  ServerOptions,
  LanguageClientOptions,
  TransportKind,
} from "vscode-languageclient/node";

export async function activate(context: vscode.ExtensionContext) {
  const startServerCommand = context.asAbsolutePath("server");

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    command: startServerCommand,
    transport: TransportKind.stdio,
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: "file", language: "firestore-rules" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/.rules"),
    },
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    "firestore-language-server-client",
    "Firestore LSP Client",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  try {
    vscode.window.showInformationMessage("Starting server");
    await client.start().then(
      () => {
        vscode.window.showInformationMessage("Server started");
      },
      (reason) => {
        vscode.window.showInformationMessage(reason);
      }
    );
  } catch (e) {
    let err: string = "";

    if (typeof e === "string") {
      err = e.toUpperCase(); // works, `e` narrowed to string
    } else if (e instanceof Error) {
      err = e.message; // works, `e` narrowed to Error
    }

    vscode.window.showInformationMessage(err);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}

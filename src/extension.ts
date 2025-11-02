import * as url from "url";
import * as vscode from "vscode";
import { workspace } from "vscode";
import {
  LanguageClient,
  ServerOptions,
  LanguageClientOptions,
  TransportKind,
  SemanticTokensRequest,
} from "vscode-languageclient/node";
import axios from "axios";
import AdmZip from "adm-zip";
import { getPort } from "get-port-please";

const LSP_VER = "0.4.1-beta";

export async function activate(context: vscode.ExtensionContext) {
  const outChannel = vscode.window.createOutputChannel("Firestore LSP Client");

  let serverPath: string;

  if (context.extensionMode === vscode.ExtensionMode.Production) {
    workspace.fs.createDirectory(context.globalStorageUri);

    outChannel.appendLine("Loading LSP to " + context.globalStorageUri.fsPath);

    try {
      const serverLocUri = await prepareAndDownloadLSP(context, outChannel);
      serverPath = serverLocUri.fsPath;
    } catch (e) {
      if (typeof e === "object") {
        vscode.window.showErrorMessage(e!.toString());
      }

      if (typeof e === "string") {
        vscode.window.showErrorMessage(e);
      }

      return;
    }
  } else {
    serverPath =
      "/Users/julind/Projects/firestore-rules-lsp/lsp/target/debug/firestore-rules-lsp";
  }

  outChannel.appendLine("Using LSP at " + serverPath);

  const serverOptions: ServerOptions = {
    command: serverPath,
    transport: {
      kind: TransportKind.socket,
      port: await getPort(),
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
    "Firestore LSP Server",
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

    outChannel.appendLine(`Server died: ${err}`);

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
    return this.client
      .sendRequest(SemanticTokensRequest.type, {
        textDocument: {
          uri: document.uri.toString(),
        },
      })
      .then((result) => {
        if (!result) {
          return { resultId: undefined, data: new Uint32Array() };
        }

        const u32IntResult = {
          resultId: result.resultId,
          data: new Uint32Array(result.data),
        } as vscode.SemanticTokens;

        return u32IntResult;
      });
  }
}

export function deactivate() {}

async function prepareAndDownloadLSP(
  context: vscode.ExtensionContext,
  outChannel: vscode.OutputChannel
): Promise<vscode.Uri> {
  return prepareLSP(context.globalStorageUri, outChannel);
}

const SERVER_EXEC_FILENAME =
  "firestore-rules-lsp" + LSP_VER.replaceAll(".", "-");

async function prepareLSP(
  folder: vscode.Uri,
  outChannel: vscode.OutputChannel
): Promise<vscode.Uri> {
  const prependURL = `https://github.com/JulindM/firestore-rules-lsp/releases/download/${LSP_VER}/firestore-rules-lsp-${LSP_VER}`;
  const arch = process.arch;
  const platform_name = process.platform;
  let execfile_extension = "";

  let downloadUrl;

  if (platform_name === "linux" && arch === "x64") {
    downloadUrl = url.parse(`${prependURL}-linux_x64.zip`);
  }

  if (platform_name === "win32" && arch === "x64") {
    downloadUrl = url.parse(`${prependURL}-win_x64.zip`);
    execfile_extension = ".exe";
  }

  if (platform_name === "darwin" && arch === "x64") {
    downloadUrl = url.parse(`${prependURL}-mac_x64.zip`);
  }

  if (platform_name === "darwin" && arch === "arm64") {
    downloadUrl = url.parse(`${prependURL}-mac_arm64.zip`);
  }

  if (!downloadUrl) {
    throw Error("Platform is not supported");
  }

  const serverExecutable = SERVER_EXEC_FILENAME + execfile_extension;

  try {
    const serverExecPath = vscode.Uri.joinPath(folder, serverExecutable);
    await workspace.fs.stat(serverExecPath);
    outChannel.appendLine("LSP already downloaded at " + serverExecPath.fsPath);
    return serverExecPath;
  } catch (_) {
    workspace.fs.readDirectory(folder).then((files) => {
      if (!files) {
        return [];
      }

      files.map(
        async (file) =>
          await workspace.fs.delete(vscode.Uri.joinPath(folder, file[0]))
      );
    });
  }

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      title: `Downloading Firestore LSP ${LSP_VER}`,
    },
    () => downloadLSP(folder, serverExecutable, downloadUrl)
  );
}

async function downloadLSP(
  folder: vscode.Uri,
  executableName: string,
  url: url.Url
): Promise<vscode.Uri> {
  let zipBlobResponse = await axios({
    url: url.href,
    method: "GET",
    responseType: "arraybuffer",
  });

  if (zipBlobResponse.status !== 200) {
    throw Error("Error getting lsp from " + url.href);
  }

  let zip = new AdmZip(zipBlobResponse.data);

  let entries = zip.getEntries();

  if (entries.length === 0) {
    throw Error("No entries found in zip");
  }

  let entry = entries.find(
    (e) => e.entryName.match("firestore-rules-lsp") !== null
  );

  if (!entry) {
    throw Error("LSP executable not found");
  }

  zip.extractEntryTo(entry, folder.fsPath, false, true, true, executableName);

  return vscode.Uri.joinPath(folder, executableName);
}

import Bencode from './bencode/index.js';
import { Buffer } from 'buffer';
import ClipboardJS from 'clipboard';
import * as FileSaver from 'file-saver';
import Key from 'keymaster';
import LZString from 'lz-string';

import Ace from 'ace-builds';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/ext-searchbox';

/// helper functions

// https://github.com/microsoft/TypeScript/pull/33050#issuecomment-543365074
interface RecordOf<T>  // eslint-disable-line @typescript-eslint/consistent-indexed-object-style
{
    [_: string]: T;
}

function isString(s: any): s is string
{
  return (Object.prototype.toString.call(s) === "[object String]");
}

function loadFile(blob: Blob): Promise<ArrayBuffer>
{
  return new Promise((resolve, _reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve(reader.result as ArrayBuffer); };
    reader.readAsArrayBuffer(blob);
  });
}

function tryEncodeHexstring(data: ArrayBuffer): string
{
  const isValidUtf8String = (str: string): boolean =>
  {
    const replacementChar = '\uFFFD';  // U+FFFD REPLACEMENT CHARACTER
    return !str.includes(replacementChar);
  };

  const encodeToHexstring = (buf: Buffer): string =>
  {
    // example: <hex>0A 0B 0C ...</hex>
    const hexStr = buf.toString('hex').toUpperCase();

    let str = "<hex>";
    for (let i = 0; i < hexStr.length; i += 2)
      str += `${hexStr.slice(i, (i + 2))} `;
    str = `${str.trimEnd()}</hex>`;
    return str;
  };

  const str = data.toString();  // eslint-disable-line @typescript-eslint/no-base-to-string
  return isValidUtf8String(str)
    ? str
    : encodeToHexstring(Buffer.from(data));
}

function tryDecodeHexstring(str: string): Buffer
{
  const isHexstring = (str: string): boolean =>
  {
    const re = /<hex>[0-9a-f ]+<\/hex>/gi;
    return re.test(str);
  };

  const decodeToBuffer = (hex: string): Buffer =>
  {
    const str = hex.substring(5, (hex.length - 6)).replace(/ /g, "");
    return Buffer.from(str, 'hex');
  };

  return isHexstring(str)
    ? decodeToBuffer(str)
    : Buffer.from(str);
}

type EncodeInTypes = number | Uint8Array | EncodeInTypes[] | Map<any, EncodeInTypes>;
type EncodeOutTypes = number | string | EncodeOutTypes[] | RecordOf<EncodeOutTypes>;

function encodeToArray(data: EncodeInTypes[]): EncodeOutTypes[]
{
  const ret = [];

  for (const val of data)
  {
    if (typeof val === "number")
    {
      ret.push(val);
    }
    else if (val instanceof Uint8Array)
    {
      ret.push(tryEncodeHexstring(val));
    }
    else if (val instanceof Array)
    {
      ret.push(encodeToArray(val));
    }
    else if (val instanceof Map)
    {
      ret.push(encodeToObject(val));
    }
    else
    {
      //throw new Error("Type unhandled: " + typeof val + "\nValue: " + val);
    }
  }

  return ret;
}

function encodeToObject(data: Map<Buffer, EncodeInTypes>): Record<string, EncodeOutTypes>
{
  const ret: ReturnType<typeof encodeToObject> = {};

  for (const [key, val] of data)
  {
    const keyString = tryEncodeHexstring(key);

    if (typeof val === "number")
    {
      ret[keyString] = val;
    }
    else if (val instanceof Uint8Array)
    {
      ret[keyString] = tryEncodeHexstring(val);
    }
    else if (val instanceof Array)
    {
      ret[keyString] = encodeToArray(val);
    }
    else if (val instanceof Map)
    {
      ret[keyString] = encodeToObject(val);
    }
    else
    {
      //throw new Error("Type unhandled: " + typeof val + "\nValue: " + val);
    }
  }

  return ret;
}

type DecodeInTypes = number | string | DecodeInTypes[] | RecordOf<DecodeInTypes>;
type DecodeOutTypes = Buffer | number | DecodeOutTypes[] | Map<any, DecodeOutTypes>;

function decodeToArray(data: DecodeInTypes[]): DecodeOutTypes[]
{
  const ret = [];

  for (const val of data)
  {
    if (typeof val === "number")
    {
      ret.push(val);
    }
    else if (isString(val))
    {
      ret.push(tryDecodeHexstring(val));
    }
    else if (val instanceof Array)
    {
      ret.push(decodeToArray(val));
    }
    else if (val instanceof Object)
    {
      ret.push(decodeToMap(val));
    }
    else
    {
      //throw new Error("Type unhandled: " + typeof val + "\nValue: " + val);
    }
  }

  return ret;
}

function decodeToMap(data: Record<string, DecodeInTypes>): Map<Buffer, DecodeOutTypes>
{
  const ret = new Map();

  for (const key in data)
  {
    if (!Object.hasOwn(data, key))
      continue;

    const val = data[key];
    const keyString = tryDecodeHexstring(key);

    if (typeof val === "number")
    {
      ret.set(keyString, val);
    }
    else if (isString(val))
    {
      ret.set(keyString, tryDecodeHexstring(val));
    }
    else if (val instanceof Array)
    {
      ret.set(keyString, decodeToArray(val));
    }
    else if (val instanceof Object)
    {
      ret.set(keyString, decodeToMap(val));
    }
    else
    {
      //throw new Error("Type unhandled: " + typeof val + "\nValue: " + val);
    }
  }

  return ret;
}

function isTorrent(data: any): boolean
{
  if (typeof data !== 'object')
    return false;

  if (!Object.prototype.hasOwnProperty.call(data, 'info'))
    return false;

  // v2 format
  if (Object.prototype.hasOwnProperty.call(data, 'piece layers'))
    return true;

  // v1 format
  const info = data.info;
  const count: number = Number(Object.prototype.hasOwnProperty.call(info, 'files')) + Number(Object.prototype.hasOwnProperty.call(info, 'length'));
  return (count === 1);
}

/// End of helper functions

class Session
{
  constructor(editorText: string)
  {
    this.editorText = editorText;

    if (this.editorText.length > 0)
      this.valid = true;
  }

  serialize(): string
  {
    const object = {
      "editorText": this.editorText
    };
    // https://github.com/pieroxy/lz-string/pull/127
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(object));
    return compressed.replace(/\+/g, '_').replace(/\$/g, '.');
  }

  static deserialize(encoded: string): Session
  {
    const decoded = encoded.replace(/\./g, '$').replace(/_/g, '+');
    const decompressed = LZString.decompressFromEncodedURIComponent(decoded);
    if ((decompressed === null) || (decompressed.length <= 0))  // eslint-disable-line @typescript-eslint/no-unnecessary-condition
      return new Session("");

    let data;
    try {
      data = JSON.parse(decompressed);
    }
    catch (exception: any) {
      if (!(exception instanceof SyntaxError))
        alert(exception.message);
      return new Session("");
    }

    if (!Object.prototype.hasOwnProperty.call(data, "editorText"))
      return new Session("");

    return new Session(data.editorText);
  }

  editorText = "";
  valid = false;
}

function main(): void
{
  // editor configs
  const jsonEditor = document.getElementById('jsonEditor')!;
  const editor = Ace.edit(jsonEditor, {
    fontSize: 14,
    mode: 'ace/mode/json',
    showPrintMargin: false
  });

  // adjust theme
  const setTheme = (isDarkTheme: boolean): void => {
    document.documentElement.setAttribute('data-bs-theme', (isDarkTheme ? 'dark' : 'light'));
    editor.setTheme(isDarkTheme ? 'ace/theme/idle_fingers' : 'ace/theme/textmate');
  };
  const isDarkThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  setTheme(isDarkThemeQuery.matches);
  isDarkThemeQuery.addEventListener('change', (event) => {
    setTheme(event.matches);
  });

  (editor.renderer as any).$textLayer.MAX_LINE_LENGTH=512;
  // disable scroll chaining
  editor.container.addEventListener("wheel", (event) => {
    event.preventDefault();
  });

  const setEditorValue = (str: string): void =>
  {
    editor.setValue(str);
    editor.gotoLine(0, 0);
    editor.scrollToLine(0, false, false);
    editor.focus();
  };

  const loadData = (fileName: string, data: Buffer): void =>
  {
    let decoded;
    try
    {
      decoded = Bencode.decode(data);
    }
    catch (_exception)
    {
      editor.setValue(`Error: "${fileName}" is not a valid bencoded file\n`);
      return;
    }

    const result = encodeToObject(decoded);
    setEditorValue(JSON.stringify(result, null, 3) + "\n");
  };

  const handleFilesInput = async (files: FileList): Promise<void> =>
  {
    editor.setValue("");

    // only handle the first file
    const fileBlob = files[0];
    const buf = Buffer.from(await loadFile(fileBlob));

    loadData(fileBlob.name, buf);
  };

  jsonEditor.addEventListener('dragover', (ev: DragEvent) => { ev.preventDefault(); });
  jsonEditor.addEventListener('dragenter', (ev: DragEvent) => { ev.preventDefault(); });
  jsonEditor.addEventListener("drop", async (ev: DragEvent) => {
    ev.preventDefault();
    await handleFilesInput(ev.dataTransfer!.files);
  });

  const fileInput = document.getElementById('fileInput')!;
  fileInput.addEventListener("change", async function(this: HTMLInputElement) {
    await handleFilesInput(this.files!);
  });

  const onOpenFile = () => {
    const fileInput = document.getElementById('fileInput')!;
    fileInput.click();
  };

  const openfileButton = document.getElementById("openfileButton")!;
  openfileButton.addEventListener("click", onOpenFile);

  const shareButton = document.getElementById('shareButton')!;
  const shareButtonText = shareButton.firstChild!.nodeValue;
  if (ClipboardJS.isSupported()) {
    const clipboard = new ClipboardJS(shareButton, {
      text: (_elem) => {
        const url = new URL(location.href);
        url.hash = (new Session(editor.getValue())).serialize();
        history.replaceState(null, "", url.href);
        return url.href;
      }
    });

    clipboard.on('success', async (_e) => {
      shareButton.firstChild!.nodeValue = "OK!";
      const _sleep = await new Promise((resolve, _reject) => { setTimeout(resolve, 1500); });
      shareButton.firstChild!.nodeValue = shareButtonText;
    });
  }

  const onSave = () => {
    const text = editor.getValue();
    if (text.length === 0)
      return;

    let obj: any;
    let data: Buffer;
    try
    {
      obj = JSON.parse(text);
      const obj2 = decodeToMap(obj);
      data = Bencode.encode(obj2);
    }
    catch (exception: any)
    {
      alert(`Save error:\n${exception.message}`);
      return;
    }

    const blob = new Blob([data], {type: 'application/octet-stream'});
    const filename = (isTorrent(obj) && Object.prototype.hasOwnProperty.call(obj.info, 'name')) ? `${obj.info.name}.torrent` : "bencoded_data";
    FileSaver.saveAs(blob, filename);
  };

  const saveBtn = document.getElementById("saveButton")!;
  saveBtn.addEventListener("click", onSave);

  const loadExampleBtn = document.getElementById("loadExampleButton")!;
  loadExampleBtn.addEventListener("click", () => {
    const exampleFileName = "assets/bbb_sunflower_1080p_60fps_normal.mp4.torrent";

    const xreq = new XMLHttpRequest();
    xreq.onreadystatechange = () => {
      if ((xreq.readyState !== XMLHttpRequest.DONE) || (xreq.status !== 200))
        return;

      loadData(exampleFileName, xreq.response);
    };
    xreq.open("GET", exampleFileName);
    xreq.responseType = "arraybuffer";
    xreq.send();
  });

  // keyboard shortcuts
  Key.filter = (_event) => { return true; };
  Key('ctrl+o, command+o', () => {
    onOpenFile();
    return false;
  });
  Key('ctrl+s, command+s', () => {
    onSave();
    return false;
  });

  // load data from URI fragment
  const compressedHash = document.location.hash.slice(1);
  if (compressedHash.length > 0) {
    const session = Session.deserialize(compressedHash);
    if (session.valid)
      setEditorValue(session.editorText);
  }
}

main();

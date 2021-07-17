import Bencode from './bencode/index.js';
import { Buffer } from 'buffer';
import FileSaver from 'file-saver';
import Key from 'keymaster';
import LZString from "lz-string";

import Ace from 'ace-builds';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/ext-searchbox';

/// helper functions

// https://github.com/microsoft/TypeScript/pull/33050#issuecomment-543365074
interface RecordOf<T>
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
    return (str.indexOf(replacementChar) === -1);
  };

  const encodeToHexstring = (buf: Buffer): string =>
  {
    // example: <hex>0A 0B 0C ...</hex>
    const hexStr = buf.toString('hex').toUpperCase();

    let str = "";
    for (let i = 0; i < hexStr.length; i += 2)
      str += (hexStr.substr(i, 2) + " ");
    str = `<hex>${str.trim()}</hex>`;
    return str;
  };

  const str = data.toString();
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

type EncodeInTypes = number | Uint8Array | Array<EncodeInTypes> | Map<any, EncodeInTypes>;
type EncodeOutTypes = number | string | Array<EncodeOutTypes> | RecordOf<EncodeOutTypes>;

function encodeToArray(data: Array<EncodeInTypes>): Array<EncodeOutTypes>
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

type DecodeInTypes = number | string | Array<DecodeInTypes> | RecordOf<DecodeInTypes>;
type DecodeOutTypes = Buffer | number | Array<DecodeOutTypes> | Map<any, DecodeOutTypes>;

function decodeToArray(data: Array<DecodeInTypes>): Array<DecodeOutTypes>
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

  for (const [key, val] of Object.entries(data))
  {
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
    return LZString.compressToEncodedURIComponent(JSON.stringify(object));
  }

  static deserialize(compressed: string): Session
  {
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    if (decompressed === null)
      return new Session("");

    const json = JSON.parse(decompressed);
    return new Session(json.editorText);
  }

  editorText = "";
  valid = false;
}

function main(): void
{
  // editor configs
  const jsonEditor = document.getElementById('jsonEditor')!;
  const editor = Ace.edit(jsonEditor);
  editor.getSession().setMode('ace/mode/json');
  editor.setShowPrintMargin(false);
  editor.setFontSize("14px");

  // Characters stop showing up after the 10000th charater in a line
  // https://github.com/ajaxorg/ace/issues/3983
  (editor.renderer as any).$textLayer.MAX_LINE_LENGTH=Infinity;

  const setEditorValue = (str: string): void =>
  {
    editor.setValue(str);
    editor.gotoLine(0, 0, undefined!);
    editor.scrollToLine(0, undefined!, undefined!, undefined!);
    editor.focus();
  };

  const loadData = (fileName: string, data: Buffer): void =>
  {
    let decoded;
    try
    {
      decoded = Bencode.decode(data);
    }
    catch(e)
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

  editor.on("change", (_ev) => {
    const url = new URL(location.href);
    url.hash = (new Session(editor.getValue())).serialize();
    history.replaceState(null, "", url.href);
  });

  jsonEditor.addEventListener('dragover', (ev: DragEvent) => { if (ev.preventDefault) ev.preventDefault(); });
  jsonEditor.addEventListener('dragenter', (ev: DragEvent) => { if (ev.preventDefault) ev.preventDefault(); });
  jsonEditor.addEventListener("drop", (ev: DragEvent) => {
    if (ev.preventDefault)
      ev.preventDefault();
    handleFilesInput(ev.dataTransfer!.files);
  });

  const fileInput = document.getElementById('fileInput')!;
  fileInput.addEventListener("change", function(this: HTMLInputElement) {
    handleFilesInput(this.files!);
  });

  const onOpenFile = () => {
    const fileInput = document.getElementById('fileInput')!;
    fileInput.click();
  };

  const openfileButton = document.getElementById("openfileButton")!;
  openfileButton.addEventListener("click", onOpenFile);

  const onSave = () => {
    const text = editor.getValue();
    if (text.length === 0)
      return;

    let data: Buffer;
    try
    {
      const obj = JSON.parse(text);
      const obj2 = decodeToMap(obj);
      data = Bencode.encode(obj2);
    }
    catch(e)
    {
      alert("Save error:\n" + e.message);
      return;
    }

    const blob = new Blob([data], {type: 'application/octet-stream'});
    FileSaver.saveAs(blob, "file");
  };

  const saveBtn = document.getElementById("saveButton")!;
  saveBtn.addEventListener("click", onSave);

  const loadExampleBtn = document.getElementById("loadExampleButton")!;
  loadExampleBtn.addEventListener("click", () => {
    const exampleFileName = "bbb_sunflower_1080p_60fps_normal.mp4.torrent";

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

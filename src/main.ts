import bencode from './bencode/index.js';
import fileSaver from 'file-saver';

import ace from 'ace-builds';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/ext-searchbox';

/// helper functions

function isString(s: object): boolean
{
  return (Object.prototype.toString.call(s) === "[object String]");
}

function loadFile(blob: Blob): Promise<ArrayBuffer>
{
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e: any) => { resolve(e.target.result); };
    reader.readAsArrayBuffer(blob);
  });
}

function tryEncodeHexstring(data: ArrayBuffer): string
{
  const isValidUtf8String = (str: string): boolean =>
  {
    const replacementChar = '\uFFFD';  // U+FFFD REPLACEMENT CHARACTER
    return (str.indexOf(replacementChar) === -1);
  }

  const encodeToHexstring = (buf: Buffer): string =>
  {
    // example: <hex>0A 0B 0C ...</hex>
    const hexStr = buf.toString('hex').toUpperCase();

    let str = "";
    for (let i = 0; i < hexStr.length; i += 2)
      str += (hexStr.substr(i, 2) + " ");
    str = ("<hex>" + str.trim() + "</hex>");
    return str;
  }

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
  }

  const decodeToBuffer = (hex: string): Buffer =>
  {
    const str = hex.substring(5, (hex.length - 6)).replace(/ /g, "");
    return Buffer.from(str, 'hex');
  }

  return isHexstring(str)
    ? decodeToBuffer(str)
    : Buffer.from(str);
}

function encodeToArray(data: Array<any>): Array<any>
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

function encodeToObject(data: Map<Buffer, any>): Record<string, any>
{
  const ret: Record<string, any> = {};

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

function decodeToArray(data: Array<any>): Array<any>
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

function decodeToMap(data: Record<string, any>): Map<Buffer, any>
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

function main(): void
{
  // editor configs
  const jsonEditor = document.getElementById('jsonEditor')!;
  const editor = ace.edit(jsonEditor);
  editor.getSession().setMode('ace/mode/json');
  editor.setShowPrintMargin(false);
  editor.setFontSize("14px");

  // Characters stop showing up after the 10000th charater in a line
  // https://github.com/ajaxorg/ace/issues/3983
  (<any> editor.renderer).$textLayer.MAX_LINE_LENGTH=Infinity;

  const loadData = (fileName: string, data: Buffer): void =>
  {
    let decoded;
    try
    {
      decoded = bencode.decode(data);
    }
    catch(e)
    {
      editor.setValue("Error: "
        + "\"" + fileName + "\""
        + " is not a valid bencoded file\n");
      return;
    }

    const result = encodeToObject(decoded);
    editor.setValue(JSON.stringify(result, null, 3) + "\n");
    editor.gotoLine(0, 0, undefined!);
    editor.scrollToLine(0, undefined!, undefined!, undefined!);
  }

  const handleFilesInput = async (files: FileList): Promise<void> =>
  {
    editor.setValue("");

    // only handle the first file
    const fileBlob = files[0];
    const buf = Buffer.from(await loadFile(fileBlob));

    loadData(fileBlob.name, buf);
  }

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

  const openfileButton = document.getElementById("openfileButton")!;
  openfileButton.addEventListener("click", () => {
    const fileInput = document.getElementById('fileInput')!;
    fileInput.click();
  });

  const saveBtn = document.getElementById("saveButton")!;
  saveBtn.addEventListener("click", () => {
    const text = editor.getValue();
    if (text.length === 0)
      return;

    let data: Buffer;
    try
    {
      const obj = JSON.parse(text);
      const obj2 = decodeToMap(obj);
      data = bencode.encode(obj2);
    }
    catch(e)
    {
      alert("Save error:\n" + e.message)
      return;
    }

    const blob = new Blob([data], {type: 'application/octet-stream'});
    fileSaver.saveAs(blob, "file");
  });

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
}

main();

import bencode from 'bencode';
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

function decodeString(data: ArrayBuffer): string
{
  const isStringValid = (str: string): boolean =>
  {
    const replacementChar = '\uFFFD';  // U+FFFD REPLACEMENT CHARACTER
    return (str.indexOf(replacementChar) === -1);
  }

  const str = data.toString();
  if (isStringValid(str))
    return str;

  // cannot convert to a valid string
  // print data as hex array
  const bufferToHexstring = (buf: Buffer): string =>
  {
    // example: <hex>0A 0B 0C ...</hex>
    const hexStr = buf.toString('hex').toUpperCase();

    let str = "";
    for (let i = 0; i < hexStr.length; i += 2)
      str += (hexStr.substr(i, 2) + " ");
    str = ("<hex>" + str.trim() + "</hex>");
    return str;
  }

  return bufferToHexstring(Buffer.from(data));
}

function bytearrayToString(obj: Record<string, any>): object
{
  // traverse through obj
  for (const key in obj)
  {
    const val = obj[key];

    if (val instanceof Number)
    {
    }
    else if (val instanceof Uint8Array)
    {
      obj[key] = decodeString(val);
    }
    else if (val instanceof Array)
    {
      bytearrayToString(val);
    }
    else if (val instanceof Object)
    {
      bytearrayToString(val);
    }
  }

  return obj;
}

function stringToBytearray(obj: Record<string, any>): object
{
  const isHexArray = (str: string): boolean =>
  {
    const re = /<hex>[0-9a-f ]+<\/hex>/gi;
    return re.test(str);
  }

  const hexstringToBuffer = (hex: string): Buffer =>
  {
    const str = hex.substring(5, (hex.length - 6)).replace(/ /g, "");
    return Buffer.from(str, 'hex');
  }

  for (const key in obj)
  {
    const val = obj[key];

    if (val instanceof Number)
    {
    }
    else if (isString(val))
    {
      if (isHexArray(val))
        obj[key] = hexstringToBuffer(val);
      else
        obj[key] = Buffer.from(val);
    }
    else if (val instanceof Array)
    {
      stringToBytearray(val);
    }
    else if (val instanceof Object)
    {
      stringToBytearray(val);
    }
  }

  return obj;
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

  function setEditorText(str: string): void
  {
    editor.setValue(str);
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

  async function handleFilesInput(files: FileList): Promise<void>
  {
    setEditorText("");

    // only handle the first file
    const fileBlob = files[0];
    const buf = Buffer.from(await loadFile(fileBlob));

    let decoded = "";
    try
    {
      decoded = bencode.decode(buf);
    }
    catch(e)
    {
      setEditorText("Error: "
        + "\"" + fileBlob.name + "\""
        + " is not a valid bencoded file\n");
      return;
    }

    const result = bytearrayToString(Object.assign({}, decoded));
    setEditorText(JSON.stringify(result, null, 3) + "\n");
    editor.gotoLine(0, 0, undefined!);
    editor.scrollToLine(0, undefined!, undefined!, undefined!);
  }

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
      const obj2 = stringToBytearray(obj);
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
}

main();

'use strict';

const bencode = require('bencode');
const fileSaver = require('file-saver');

const ace = require('brace');
require('brace/mode/json');
require('brace/ext/searchbox');

/// helper functions

function isString(s)
{
  return (Object.prototype.toString.call(s) === "[object String]");
}

function toArrayBuffer(blob)
{
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => { resolve(e.target.result); };
    reader.readAsArrayBuffer(blob);
  });
}

function decodeString(data)
{
  const isStringValid = (str) =>
  {
    const replacementChar = '\uFFFD';  // U+FFFD REPLACEMENT CHARACTER
    return (str.indexOf(replacementChar) === -1);
  }

  const buf = Buffer.from(data);

  const str = buf.toString();
  if (isStringValid(str))
    return str;

  // cannot convert to a valid string
  // print data as hex array
  const bufferToHexstring = (buf) =>
  {
    // example: <hex>0A 0B 0C ...</hex>
    const hexStr = buf.toString('hex').toUpperCase();

    var str = "";
    for (var i = 0; i < hexStr.length; i += 2)
      str += (hexStr.substr(i, 2) + " ");
    str = ("<hex>" + str.trim() + "</hex>");
    return str;
  }

  return bufferToHexstring(buf);
}

function bytearrayToString(obj)
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

function stringToBytearray(obj)
{
  const isHexArray = (str) =>
  {
    const re = /<hex>[0-9a-f ]+<\/hex>/gi;
    return re.test(str);
  }

  const hexstringToBuffer = (hex) =>
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

function main()
{
  // editor configs
  const jsonEditor = document.getElementById('jsonEditor');
  const editor = ace.edit(jsonEditor);
  editor.getSession().setMode('ace/mode/json');
  editor.setShowPrintMargin(false);
  editor.setFontSize(14);

  function setEditorText(str)
  {
    editor.setValue(str);
  }

  jsonEditor.addEventListener('dragover', (ev) => { if (ev.preventDefault) ev.preventDefault(); });
  jsonEditor.addEventListener('dragenter', (ev) => { if (ev.preventDefault) ev.preventDefault(); });
  jsonEditor.addEventListener("drop", (ev) => {
    if (ev.preventDefault)
      ev.preventDefault();
    handleFilesInput(ev.dataTransfer.files);
  });

  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener("change", function() {
    handleFilesInput(this.files);
  });

  async function handleFilesInput(files)
  {
    setEditorText("");

    // only handle the first file
    const fileBlob = files[0];
    const buf = await toArrayBuffer(fileBlob);

    var decoded = "";
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
    editor.gotoLine(0, 0);
    editor.scrollToLine(0);
  }

  const openfileButton = document.getElementById("openfileButton");
  openfileButton.addEventListener("click", () => {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();
  });

  const saveBtn = document.getElementById("saveButton");
  saveBtn.addEventListener("click", () => {
    const text = editor.getValue();
    if (text.length === 0)
      return;

    var data = {};
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

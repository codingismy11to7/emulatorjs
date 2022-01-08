//Default vars
var storeName = 'RetroArch';
var afs;
BrowserFS.install(window);
var fs = require('fs');
var mfs = new BrowserFS.FileSystem.MountableFileSystem();

// Render file list
async function renderFiles(directory) {
  directory = directory.replace("|","'");
  let directoryClean = directory.replace("'","|");
  if ((directory !== '/') && (directory.endsWith('/'))) {
    directory = directory.slice(0, -1);
  }
  $('#filebrowser').empty();
  $('#filebrowser').data('directory', directory);
  let items = await fs.readdirSync(directory);
  let baseName = directory.split('/').at(-1); 
  let parentFolder = directory.replace(baseName,'');
  let parentLink = $('<td>').addClass('directory').attr('onclick', 'renderFiles(\'' + parentFolder + '\');').text('..');
  if (directoryClean == '/') {
    directoryClean = '';
  }
  let table = $('<table>').addClass('fileTable');
  let tableHeader = $('<tr>');
  for await (name of ['Name', 'Type', 'Delete']) {
    tableHeader.append($('<th>').text(name));
  }
  let parentRow = $('<tr>');
  for await (item of [parentLink, $('<td>').text('Parent'), $('<td>')]) {
    parentRow.append(item);
  }
  table.append(tableHeader,parentRow);
  $('#filebrowser').append(table);
  if (items.length > 0) {
    for await (let item of items) {
      let tableRow = $('<tr>');
      let itemClean = item.replace("'","|");
      if (fs.lstatSync(directory + '/' + item).isDirectory()) {
        var link = $('<td>').addClass('directory').attr('onclick', 'renderFiles(\'' + directoryClean + '/' + itemClean + '\');').text(item);
        var type = $('<td>').text('Dir');
      } else {
        var link = $('<td>').addClass('file').attr('onclick', 'downloadFile(\'' + directoryClean + '/' + itemClean + '\');').text(item);
        var type = $('<td>').text('File');
      }
      for await (item of [link, type, $('<td>')]) {
        tableRow.append(item);
      }
      table.append(tableRow);
    }
  }
}

// Download file when clicked
async function downloadFile(file) {
  file = file.replace("|","'");
  let fileName = file.split('/').at(-1);
  let data = fs.readFileSync(file);
  let blob = new Blob([data], { type: "application/octetstream" });
  let url = window.URL || window.webkitURL;
  link = url.createObjectURL(blob);
  let a = $("<a />");
  a.attr("download", fileName);
  a.attr("href", link);
  $("body").append(a);
  a[0].click();
  $("body").remove(a);
}

// Upload file to current directory
async function upload(input) {
  let directory = $('#filebrowser').data('directory');
  if (directory == '/') {
    directoryUp = '';
  } else {
    directoryUp = directory;
  }
  if (input.files && input.files[0]) {
    let reader = new FileReader();
    reader.onload = function(e) {
      let fileName = input.files[0].name;
      let data = e.target.result;
      fs.writeFileSync(directoryUp + '/' + fileName, Buffer.from(data));
      renderFiles(directory);
    }
    reader.readAsArrayBuffer(input.files[0]);
  }
}

// Create a directory
async function createFolder() {
  let folderName = $('#folderName').val();
  $('#folderName').val('');
  if ((folderName.length == 0) || (folderName.includes('/'))) {
    alert('Bad or Null Directory Name');
    return '';
  }
  let directory = $('#filebrowser').data('directory');
  if (directory == '/') {
    directoryUp = '';
  } else {
    directoryUp = directory;
  }
  let createD = directoryUp + '/' + folderName;
  if (!fs.existsSync(createD)){
    fs.mkdirSync(createD);
  }
  renderFiles(directory);
}


// Download a full backup of all files
async function downloadBackup() {
  var zip = new JSZip();
  let items = await fs.readdirSync('/');
  async function addToZip(item) {
    if (fs.lstatSync(item).isDirectory()) {
      let items = await fs.readdirSync(item);
      if (items.length > 0) {
        for await (let subPath of items) {
          await addToZip(item + '/' + subPath);
        }
      }
    } else {
      let data = fs.readFileSync(item);
      let zipPath = item.replace(/^\//,'');
      zip.file(zipPath, data);
    }
    return ''
  }
  for await (let item of items) {
    await addToZip(item);
  }
  zip.generateAsync({type:"blob"}).then(function callback(blob) {
    let url = window.URL || window.webkitURL;
    link = url.createObjectURL(blob);
    let a = $("<a />");
    a.attr("download", storeName + '.zip');
    a.attr("href", link);
    $("body").append(a);
    a[0].click();
    $("body").remove(a);    
  });
}

// Upload a full backup
async function uploadBackup(input) {
  if (input.files && input.files[0]) {
    let reader = new FileReader();
    reader.onload = async function(e) {
      let data = e.target.result;
      var zip = new JSZip();
      // Load zip from data
      zip.loadAsync(data).then(async function(contents) {
        // Purge current storage
        async function rmDir(dirPath, removeSelf) {
          try { var files = fs.readdirSync(dirPath); }
          catch(e) { return; }
          if (files.length > 0) {
            for await (let file of files) {
              var filePath = dirPath + '/' + file;
              if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
	      } else {
                rmDir(filePath);
              }
            }
          }
          if (dirPath !== '/') {
            fs.rmdirSync(dirPath)
          }
          return '';
        }
        await rmDir('/');
        // Unzip the files to the FS by name
        for await (let fileName of Object.keys(contents.files)) {
          if (fileName.endsWith('/')) {
            if (! fs.existsSync('/' + fileName)) {
              fs.mkdirSync('/' + fileName);
            }
          }
        }
        for await (let fileName of Object.keys(contents.files)) {
          if (! fileName.endsWith('/')) {
            zip.file(fileName).async('arraybuffer').then(function(content) {
              fs.writeFileSync('/' + fileName, Buffer.from(content));
            });
          }
	}
        await new Promise(resolve => setTimeout(resolve, 2000));
        renderFiles('/');
      });
    }
    reader.readAsArrayBuffer(input.files[0]);
  }
}

// Create Async filestore
async function setupFileSystem() {
  var imfs = new BrowserFS.FileSystem.InMemory();
  afs = new BrowserFS.FileSystem.AsyncMirror(imfs,
    new BrowserFS.FileSystem.IndexedDB(async function(e, fs) {
      afs.initialize(async function(e) {
        console.log('IndexedDB setup successful');
        setupMounts();
      });
    },
  storeName));
};

// Setup mounts
async function setupMounts() {
  mfs.mount('/', afs);
  BrowserFS.initialize(mfs);
  renderFiles('/');
}

// On page load
window.onload = function() {
  setupFileSystem();
}
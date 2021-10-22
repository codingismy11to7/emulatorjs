var host = window.location.hostname; 
var port = window.location.port;
var protocol = window.location.protocol;
var socket = io(protocol + '//' + host + ':' + port, {});
var mainOptions = [
  'title',
  'root',
  'parent',
  'display_items'
];
var defaultKeys = [
  'type',
  'emulator',
  'bios',
  'path',
  'rom_extension',
  'video_position',
  'has_logo',
  'has_video',
  'has_back',
  'has_corner'
];
var defaultDropdowns = { 
  'use_default_art': ['default', true, false],
  'has_logo': ['default', true, false],
  'has_video': ['default', true, false],
  'has_back': ['default', true, false],
  'has_corner': ['default', true, false],
  'type': ['default', 'game', 'menu'],
  'emulator': [
    'default',
    '3do',
    'arcade',
    'atari2600',
    'atari7800',
    'gb',
    'gba',
    'jaguar',
    'lynx',
    'msx',
    'n64',
    'nds',
    'nes',
    'ngp',
    'pce',
    'psx',
    'sega32x',
    'segaCD',
    'segaGG',
    'segaMD',
    'segaMS',
    'segaSaturn',
    'snes',
    'vb',
    'ws'
  ]
};

//// Socket recieves ////
// Render config
socket.on('renderconfig', renderConfig);
// Render rom
socket.on('renderrom', renderRom);
// Render configs
socket.on('renderconfigs', renderConfigs);
// Render roms directories
socket.on('renderromsdir', renderRomsDir);
// Render roms scanners
socket.on('renderromslanding', renderRomsLanding);
// Render Landing
socket.on('renderlanding', renderLanding);
// Render modal data
socket.on('modaldata', modalData);

//// Functions ////
// Grab a json file from the server
function getConfig(file) {
  $('#main').data('name', file);
  socket.emit('getconfig', file);
};
// Get list of rom shas to process
function getRomShas(dir) {
  $('#main').empty();
  $('#main').append('<div class="loader"></div>');
  $('#main').data('name', dir);
  socket.emit('getroms', dir);
};
// Render configs page
function renderConfigss() {
  socket.emit('renderconfigs');
};
// Render roms landing page
async function renderRomsLanding() {
  $('#main').empty();
  for await (var emu of defaultDropdowns.emulator) {
    if (emu !== 'default') {
      var button = $('<button>').addClass('scanbutton').text('Scan ' + emu);
      button.attr('onClick', 'scanRoms(\'' + emu + '\');');
      $('#main').append(button);
    };
  };
  $('#main').append($('#rominfo').html());
};

// Render roms page
function renderRoms() {
  socket.emit('renderroms');
}

// Scan in a roms directory
function scanRoms(folder) {
  socket.emit('scanroms', folder);
  $('#modal').modal();
};

// Prompt user to identify rom
async function identifyRom(sha, name) {
  $('#modal').modal();
  $('#modal').empty();
  $('#modal').data('sha', sha.replace("|","'"));
  $('#modal').append('<p>Identify: ' + name.replace("|","'") + '</p>');
  var metaData = $('#main').data('metadata');
  var sel = $('<select>').attr('id', 'gameselection');
  for await (sha of Object.keys(metaData)) {
    if (metaData[sha].hasOwnProperty('name')) {
      sel.append($("<option>").attr('value',sha).text(metaData[sha].name));
    }
  };
  $('#modal').append(sel);
  var setMetaButton = $('<button>').attr('onClick', 'setMeta()').text('Link Item');
  $('#modal').append(setMetaButton);
};

// Link metadata for selected rom
function setMeta() {
  var foundGameSha = $('#gameselection').val();
  var romSha = $('#modal').data('sha');
  var dir = $('#main').data('name');
  $('#main').empty();
  $('#main').append('<div class="loader"></div>');
  $.modal.close();
  socket.emit('usermeta', [romSha, foundGameSha, dir]);
};

// Send output to modal
function modalData(data) {
  $('#modal').empty();
  $('#modal').append('<p>' + data + '</p>'); 
};
// Set main values
async function setMains(config) {
  for await (var key of mainOptions) {
    var value = $('#main_' + key).val();
    if (!value) {
      var value = '';
    };
    if (key = 'display_items') {
      var value = Number(value);
    };
    config[key] = value;
  };
  $('#main').data('config', config);
};

// Set default values
async function setDefaults(config) {
  var defaultKeys2 = defaultKeys.slice(1);
  for await (var key of defaultKeys2) {
    var value = $('#defaults_' + key).val();
    if (!value) {
      var value = '';
    };
    if (value == 'false') {
      var value = false;
    } else if (value == 'true') {
      var value = true;
    }
    config.defaults[key] = value;
  };
  $('#main').data('config', config);
};

// Commit changes to cached config and re-render
async function setItem() {
  var value = $('#edititem').val();
  if (value == 'false') {
    var value = false;
  } else if (value == 'true') {
    var value = true;
  }
  var cleanName = $('#edititem').data('cleanName');
  var name = cleanName.replace("|","'");
  var key = $('#edititem').data('key');
  var config = $('#main').data('config');
  if ((value == 'default') || (value == '')) {
    delete config.items[name][key];
  } else {
    config.items[name][key] = value;
  }
  $.modal.close();
  await setDefaults(config);
  await setMains(config);
  var config = $('#main').data('config');
  renderConfig(config);
};

// Edit single item
async function editItem(key, cleanName, value) {
  var name = cleanName.replace("|","'");
  $('#modal').empty();
  $('#modal').append('<p>' + name + '</p>');
  var inputLine = $('<p>')
  inputLine.append(key + ': ');
  if (defaultDropdowns.hasOwnProperty(key)) {
    var sel = $('<select>').attr('id', 'edititem');
    for await (option of defaultDropdowns[key]) {
      sel.append($("<option>").attr('value',option).text(option));
    };
    inputLine.append(sel);
  } else {
    inputLine.append('<input type="text" id="edititem" value="' + value + '">');
  }
  $('#modal').append(inputLine);
  var setButton = $('<button>').attr('onclick', 'setItem()').text('Set');
  $('#modal').append(setButton);
  $('#edititem').data('cleanName', cleanName);
  $('#edititem').data('key', key);
};

// Render config file list
function renderConfigs(files) {
  $('#main').empty();
  $('#side').empty();
  $('#nav-buttons').empty();
  var sideTable = $('<table>').addClass('side-table');
  $.each(files, function(index, file) {
    var file = file.replace('.json','');
    var sideRow = $('<tr>').addClass('side-row').attr('onclick', "getConfig('" + file + "')").text(file);
    sideTable.append(sideRow);
  });
  $('#side').append(sideTable);
};

// Render Roms file list
function renderRomsDir(dirs) {
  $('#side').empty();
  $('#nav-buttons').empty();
  var sideTable = $('<table>').addClass('side-table');
  $.each(dirs, function(index, dir) {
    var sideRow = $('<tr>').addClass('side-row').attr('onclick', "getRomShas('" + dir + "')").text(dir);
    sideTable.append(sideRow);
  });
  $('#side').append(sideTable);
};

// Save modified config
async function saveConfig() {
  var config = $('#main').data('config');
  var name = $('#main').data('name');
  await setDefaults(config);
  await setMains(config);
  socket.emit('saveconfig', {'config': config, 'name': name});
  socket.emit('renderconfigs');
};

// Save romlist to config file
function addToConfig(name) {
  $('#main').empty();
  $('#main').append('<div class="loader"></div>'); 
  socket.emit('addtoconfig', name);
};

// Download art for all identified roms
function downloadArt(name) {
  $('#main').empty();
  $('#main').append('<div class="loader"></div>');
  $('#modal').modal();
  socket.emit('downloadart', name);
};

// Tell server to download the default file set
function dlDefaultFiles() {
  $('#main').empty();
  $('#main').append('<div class="loader"></div>');
  $('#modal').modal();
  socket.emit('dldefaultfiles');
};

// Render in a config file
async function renderConfig(config) {
  // Save button
  $('#nav-buttons').empty();
  var save = $('<button>').attr('onClick', 'saveConfig()').text('Save');
  $('#nav-buttons').append(save);
  // Defaults side menu
  $('#side').empty();
  for await (var key of mainOptions) {
    var inputLine = $('<p>');
    inputLine.append( key + ': ');
    inputLine.append('<input type="text" id="main_' + key + '" value="' + config[key] + '">');
    $('#side').append(inputLine);
  };
  var defaults = config.defaults;
  var defaultKeys2 = defaultKeys.slice(1);
  for await (var key of defaultKeys2) {
    var inputLine = $('<p>')
    inputLine.append( key + ': ');
    if (defaultDropdowns.hasOwnProperty(key)) {
      var sel = $('<select>').attr('id', 'defaults_' + key);
      for await (option of defaultDropdowns[key]) {
        if (option !== 'default') {
          sel.append($("<option>").attr('value',option).text(option));
        }
      };
      inputLine.append(sel);
      $('#side').append(inputLine);
      $('#defaults_' + key).val(defaults[key].toString()).change();
    } else {
      inputLine.append('<input type="text" id="defaults_' + key + '" value="' + defaults[key] + '">');
      $('#side').append(inputLine);
    }
  };
  // Main edit window
  $('#main').empty();
  $('#main').data('config', config);
  var itemsTable = $('<table>').addClass('item-table');
  var itemsHead = $('<thead>');
  var headRow = $('<tr>').addClass('head-row').attr('id', 'keys');
  headRow.append($('<th>').text('name'));
  for await (var key of defaultKeys) {
    headRow.append($('<th>').text(key));
  };
  itemsHead.append(headRow);
  itemsTable.append(itemsHead);
  var itemsBody = $('<tbody>');
  itemsTable.append(itemsBody);
  $('#main').append(itemsTable);
  for (var name of Object.keys(config.items)) {
    var item = config.items[name];
    var cleanName = name.replace("'","|");
    var itemRow = $('<tr>').addClass('item-row').attr('id', name);
    itemRow.append($('<th>').text(name));
    for (var key of defaultKeys) {
      if (item.hasOwnProperty(key)) {
        var tdHtml = '<p>' + item[key] + ' <a href="#modal" rel="modal:open" onclick="editItem(\'' + key + '\',\'' + cleanName + '\',\'' + item[key] + '\')">\u270E</a></p>'
        itemRow.append($('<td>').html(tdHtml));
      } else {
          var tdHtml = '<p>default <a href="#modal" onclick="editItem(\'' + key + '\',\'' + cleanName + '\',\'default\')" rel="modal:open">\u270E</a></p>'
          itemRow.append($('<td>').html(tdHtml));
      };
    };
    itemsBody.append(itemRow);
  }
};

// Render in roms data
async function renderRom(data) {
  $('#main').empty();
  $('#main').data('unidentified', data[1]);
  $('#main').data('metadata', data[2]);
  $('#side').empty();
  // Render Legend
  var keys = [['All Art Downloaded', 'green'], ['Art Available for Download', 'red'], ['No Art Available', 'gray']]
  var header = $('<div>')
  for await (var key of keys) {
    var item = $('<div>').addClass('inline').css('background-color',key[1]).text(key[0]);
    header.append(item);
  }
  $('#main').append(header,'<br>')
  var container = $('<div>').attr('id', 'container');
  $('#main').append(container);
  var left = $('<div>').attr('id', 'left').append('<p>Identified Roms</p>');
  var right = $('<div>').attr('id', 'right').append('<p>Unidentified Roms</p>');
  $('#container').append(left,right);
  // Process buttons
  var folderName = $('#main').data('name');
  var downloadArtButton = $('<button>').addClass('downloadartbutton').attr('onClick', 'downloadArt(\'' + folderName + '\');').text('Download All Available Art');
  $('#side').append(downloadArtButton);
  var configButton = $('<button>').addClass('addtoconfigbutton').attr('onClick', 'addToConfig(\'' + folderName + '\');').text('Add All Roms to Config');
  $('#side').append(configButton);
  // Render items
  for await (var idItem of Object.keys(data[0])) {
    if (data[0][idItem].has_art == true) {
      var color = 'green';
    } else if (data[0][idItem].has_art == false) {
      var color = 'red';
    } else if (data[0][idItem].has_art == 'none') {
      var color = 'gray';
    };
    var item = $('<p>').css('background-color', color).text(idItem);
    $('#left').append(item)
  };
  for await (var noIdItem of Object.keys(data[1])) {
    var item = $('<p>').text(noIdItem);
    var identifyButton = $('<button>').attr('onClick', 'identifyRom(\'' + data[1][noIdItem].replace("'","|") + '\',\'' + noIdItem.replace("'","|") + '\');').text('identify');
    item.append(identifyButton);
    $('#right').append(item)
  };
};

// Render in landing
async function renderLanding() {
  // Clear page
  $('#main').empty();
  $('#side').empty();
  var dlButton = $('<button>').attr('onclick', 'dlDefaultFiles()').text('Download Default Files');
  $('#main').append(dlButton);
};

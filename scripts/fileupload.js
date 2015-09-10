// $(document).ready(function() {
var DataHandler = (function() {
  var MOD = MOD || {};
  // MOD.decodedData;

  MOD.init = function() {
      if (window.File && window.FileReader && window.FileList && window.Blob) {

        document.getElementById('parse').addEventListener('click', function(evt) {
          // if (evt.target.tagName.toLowerCase() == 'button') {
          readBlob();
          // }
        }, false);

      } else {
        alert('The File APIs are not fully supported in this browser.');
      }
    };
    /* Function for decoding the input data file. This acts as the interface for decoding.
     * From this, the decoding is delegated to a function which can handle the particular type
     * of file input by the user
     */
  function decode(data, filetype) {
    switch (filetype) {
      case 'csv':
        return decodeCSV(data);
      default:
        alert('Unsupported data format');
    }
  }

  function decodeCSV(txtdata) {
    $.getScript('shapetest/csv.min.js', function() {
      var data = $.csv.toArrays(txtdata);
      html = '';
      //console.log(data);
      for (var row in data) {
        html += '<tr>\r\n';
        for (var item in data[row]) {
          html += '<td>' + jQuery.trim(data[row][item]) + '</td>\r\n';
          data[row][item] = jQuery.trim(data[row][item]);
          console.log("(" + row + "," + item + ")");
        }
        html += '</tr>\r\n';
      }
      MOD.decodedData = toAssociativeArray(data);
      $('#decoded').html(html);
      return data;
    });
  }

  function toAssociativeArray(data) {
    var ascData = {};

    for (var i = 1; i < data.length; i++) {
      ascData[i-1] = {};
      for(var j=0; j < data[i].length; j++)
        ascData[i-1][data[0][j]] = data[i][j];
    }

    return ascData;
  }

  function readBlob() {

    var files = document.getElementById('csvfiles').files;

    if (!files.length) {
      alert('Please select a file!');
      return;
    }

    var file = files[0];
    var reader = new FileReader();

    // If we use onloadend, we need to check the readyState.
    reader.onloadend = function(evt) {
      if (evt.target.readyState == FileReader.DONE) { // DONE == 2
        var filetype = file.name.toLowerCase().split('.').pop();
        // document.getElementById('text').textContent = evt.target.result;
        document.getElementById('details').textContent = filetype;
        // document.getElementById('details').textContent =
        //     ['Read bytes: ', start + 1, ' - ', stop + 1,
        //      ' of ', file.size, ' byte file'].join('');
        decode(evt.target.result, filetype);
      }
    };

    reader.readAsBinaryString(file);
  }

  return MOD;
}());
// });

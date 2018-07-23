const path = require('path');
const Parse = require('parse/node');
const formidable = require('formidable');
const yauzl = require('yauzl-promise');
// API
const ftpClient = require('./ftp-client');
const xlsxHandler = require('./xlsx-handler');

module.exports = async function uploadFile(req, res, dbCv, dbMain) {
  console.log(`express: file upload initiated`);
  console.log(req.headers);

  const form = new formidable.IncomingForm();
  form.uploadDir = `./uploads`;
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      if (fields.length === 0) throw 'no fields';
      if (files.length === 0) throw 'no file';

      console.log(fields);

      const clientId = fields.clientId;
      const authorId = fields.authorId;
      const file = files[Object.keys(files)[0]];
      const fileBasename = path.basename(file.path);
      const uploadUserFilename = file.name;
      const uploadSize = file.size;

      console.log(`form: bytes received: ${form.bytesReceived}`);
      console.log(`form: bytes expected: ${form.bytesExpected}`);

      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.status(200).end(fileBasename);

      if (file.type === 'application/vnd.ms-excel'
       || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          console.log('uploadFile: xls/xlsx received');

          const data = {
            clientId: clientId,
            filepath: file.path,
          }

          return xlsxHandler(data, dbCv, dbMain);
        }

      // FTP transfer
      const transferData = {
        client: fileBasename,
        filename: file.name,
        filepath: file.path
      }
      ftpClient.upload(transferData); // async

      // count totoal quantity of files inside zipFile
      let zipFile = await yauzl.open(file.path);
      let filesTotal = 0;// = zipFile.entryCount;
      await zipFile.walkEntries(entry => {
        if (entry.uncompressedSize === 0 ) return; // directory not to count
        filesTotal++;
      });
      console.log(`zip: Quantity of entries in zipFile: ${filesTotal}`);

      /* deprecated => recieve Base64Data from rchilli back
      await zipFile.walkEntries(async (entry) => {
        const readStream = await entry.openReadStream();
        const writeStream = fs.createWriteStream(`./uploads/${entry.fileName}`);
        readStream.pipe(writeStream);
      });
      */

      await zipFile.close();

      const bulkData = {
        clientId: clientId,
        authorId: authorId,
        uploadUserFilename: uploadUserFilename,
        uploadFilename: fileBasename,
        filesTotal: filesTotal,
        uploadSize: uploadSize
      }
      const bulkUploadParse = await Parse.Cloud.run('saveIncomingFile', { bulk: bulkData })

      let bulkUpload = await dbCv.collection('BulkUploads').findOne({ _id: bulkUploadParse.id });

      const author = await dbMain.collection('_User').findOne({ _id: bulkUpload._p_author.slice(-10) }, { fields: { firstName: 1, lastName: 1, email: 1} });
      bulkUpload.authorFullname = `${author.firstName} ${author.lastName}`;
      bulkUpload.authorEmail = author.email;
      await dbMain.collection('BulkUploads').insertOne(bulkUpload);
      console.log('mongoMain: bulkUpload saved');

    } catch(err) {
      console.error(err);
      res.status(500).end(err);
      return err;
    }
  });
}

const Ftp = require('promise-ftp');

const ftpSettings = require('./../config/ftp-config');

exports.upload = async function (transfer) {
  const ftp = new Ftp();
  console.log(`FTP: connecting to rchilli`);
  try {
    const serverMessage = await ftp.connect(ftpSettings);
    console.log(`FTP: connected to rchilli: ${serverMessage}`);

    console.log(`FTP: file to be uploaded`);
    //const input = Buffer.from(transfer.file, 'base64');
    const input = transfer.filepath;
    console.log(input);
    const destPath = `${transfer.filename}`;
    console.log(destPath);

    await ftp.mkdir(`/${transfer.client}`, true);
    await ftp.cwd(transfer.client);

    await ftp.put(input, destPath);
    console.log(`FTP: file uploaded`);

    ftp.end();
    console.log(`FTP: connection closed`);
    return `success`;

  } catch(err) {
    ftp.end();
    console.error(err);
    throw err;
  }
};

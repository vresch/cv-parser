# cv-parser

part of cv-parser server

receive file from client.
if it is XLSX => parse it in JS objects, save it in local DB, transfer to main DB
if it is ZIP => upload to 3rd party parser-service to their FTP-server

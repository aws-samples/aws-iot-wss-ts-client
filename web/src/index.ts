import { Client, Message} from 'paho-mqtt';
import * as moment from "moment";
import { HmacSHA256, SHA256, enc } from 'crypto-js';


// Define application constants, including credentails
const applicationData = {
    clientId: "",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    region: "",
    endpoint: "",
    topic: ""
}

const applicationConstants = {
  OK_CONNECTED: "Connection OK! Ready to receive data on selected topic: ",
  ERR_CONNECTED: "Connection ERROR! Reload this page and check your settings. "
}

var mqtt_client: Client;

// Helper functions to perform sigv4 operations
function SigV4Utils(){}
SigV4Utils.sign = function(key: any, msg: any){
  var hash = HmacSHA256(msg, key);
  return hash.toString(enc.Hex);
};
SigV4Utils.sha256 = function(msg: any) {
  var hash = SHA256(msg);
  return hash.toString(enc.Hex);
};
SigV4Utils.getSignatureKey = function(key: any , dateStamp: any, regionName: any, serviceName: any) {
  var kDate = HmacSHA256(dateStamp, 'AWS4' + key);
  var kRegion = HmacSHA256(regionName, kDate);
  var kService = HmacSHA256(serviceName, kRegion);
  var kSigning = HmacSHA256('aws4_request', kService);
  return kSigning;
};

function startSession() {

  // Get timestamp and format data
  var time = moment.utc();
  var dateStamp = time.format('YYYYMMDD');
  var amzdate = dateStamp + 'T' + time.format('HHmmss') + 'Z';
  // Define constants used to create the message to be signed
  var service = 'iotdevicegateway';
  var region = applicationData.region;
  var secretKey = applicationData.secretAccessKey
  var accessKey = applicationData.accessKeyId
  var algorithm = 'AWS4-HMAC-SHA256';
  var method = 'GET';
  var canonicalUri = '/mqtt';
  var host = applicationData.endpoint;

  // Set credential scope to today for a specific service in a specific region
  var credentialScope = dateStamp + '/' + region + '/' + service + '/' + 'aws4_request';
  // Start populating the query string
  var canonicalQuerystring = 'X-Amz-Algorithm=AWS4-HMAC-SHA256';
  // Add credential information
  canonicalQuerystring += '&X-Amz-Credential=' + encodeURIComponent(accessKey + '/' + credentialScope);
  // Add current date
  canonicalQuerystring += '&X-Amz-Date=' + amzdate;
  // Add expiry date
  canonicalQuerystring += '&X-Amz-Expires=86400';
  // Add headers, only using one = host
  canonicalQuerystring += '&X-Amz-SignedHeaders=host';
  var canonicalHeaders = 'host:' + host + '\n';
  // No payload, empty
  var payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // empty string -> echo -n "" | xxd  | shasum -a 256
  // Build canonical request
  var canonicalRequest = method + '\n' + canonicalUri + '\n' + canonicalQuerystring + '\n' + canonicalHeaders + '\nhost\n' + payloadHash;
  console.log('canonicalRequest: \n' + canonicalRequest);
  // Hash the canonical request and create the message to be signed
  var stringToSign = algorithm + '\n' +  amzdate + '\n' +  credentialScope + '\n' +  SigV4Utils.sha256(canonicalRequest);
  // Derive the key to be used for the signature based on the scoped down request
  var signingKey = SigV4Utils.getSignatureKey(secretKey, dateStamp, region, service);
  console.log('stringToSign: \n'); console.log(stringToSign);
  console.log('signingKey: \n'); console.log(signingKey);
  // Calculate signature
  var signature = SigV4Utils.sign(signingKey, stringToSign);
  // Append signature to message
  canonicalQuerystring += '&X-Amz-Signature=' + signature;
  // Append existing security token to the request (since we are using STS credetials) or do nothing if using IAM credentials
  if (applicationData.sessionToken !== "") {
    canonicalQuerystring += '&X-Amz-Security-Token=' + encodeURIComponent(applicationData.sessionToken);  
  } 
  var requestUrl = 'wss://' + host + canonicalUri + '?' + canonicalQuerystring;
  console.log(requestUrl);

  mqtt_client = new Client(requestUrl, applicationData.clientId);
  mqtt_client.onMessageArrived = onMessageArrived;
  mqtt_client.onConnectionLost = onConnectionLost;
  mqtt_client.connect(connectOptions);

}

function onConnect() {
    console.log("OK: Connected!");
    document.getElementById("form_field_settings_dialog").style.display = "block";
    document.getElementById("form_field_settings_dialog").innerText = applicationConstants.OK_CONNECTED + applicationData.topic + "\r\n";
    // subscribe to test topic
    mqtt_client.subscribe(applicationData.topic);
   
}
function onFailure(e: any) {
    document.getElementById("form_field_settings_dialog").style.display = "block";
    document.getElementById("form_field_settings_dialog").innerText = applicationConstants.ERR_CONNECTED + "\r\n";
    console.log(e); 
}
function onMessageArrived (m: Message) {
    console.log("onMessageArrived:" + m.payloadString);
    document.getElementById("form_field_settings_dialog").innerText += m.payloadString+"\r\n";


}
function onConnectionLost (e: any) {
    console.log("onConnectionLost:" + e);
    
}
var connectOptions = {
    onSuccess: onConnect,
    onFailure: onFailure,
    useSSL: true,
    timeout: 3
};


document.getElementById("connet_button").addEventListener("click", function() {

  applicationData.clientId = (<HTMLInputElement>document.getElementById("form_field_clientId")).value;
  applicationData.accessKeyId = (<HTMLInputElement>document.getElementById("form_field_accessKeyId")).value;
  applicationData.secretAccessKey = (<HTMLInputElement>document.getElementById("form_field_secretAccessKey")).value;
  applicationData.sessionToken = (<HTMLInputElement>document.getElementById("form_field_sessionToken")).value;
  applicationData.region = (<HTMLInputElement>document.getElementById("form_field_region")).value;
  applicationData.endpoint = (<HTMLInputElement>document.getElementById("form_field_endpoint")).value;
  applicationData.topic = (<HTMLInputElement>document.getElementById("form_field_topic")).value;

  startSession();

  document.getElementById("form_field_settings_form").style.display = "none";
  document.getElementById("form_field_settings_dialog").style.display = "block";



});

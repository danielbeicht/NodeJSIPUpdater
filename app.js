var request = require('sync-request');
var AsyncPolling = require('async-polling');
var Address4 = require('ip-address').Address4;
var fs = require('fs');
var urls = ['https://api.ipify.org', 'https://wtfismyip.com/text', 'https://myexternalip.com/raw', 'http://ipecho.net/plain'];

// Global Variables
var zoneID = '';
var dnsRecordID = '';
var xAuthEmail = '';
var xAuthKey = '';
var domainName = '';
var updateInterval = 15;	// in Sekunden


// Program
AsyncPolling(function (end) {
    var currentCloudflareIP = getCurrentCloudflareIP();
    var currentIP = getCurrentIP();
    if (currentCloudflareIP != null && currentIP != null && currentCloudflareIP != currentIP){
        updateCloudflareDNSRecord(currentIP);
    } else if (currentCloudflareIP != null && currentIP != null && currentCloudflareIP == currentIP){
        console.log('Info: Adressen stimmen ueberein');
    }
    end();
}, updateInterval*1000).run();

function getCurrentCloudflareIP(){
    var options = {headers: {'X-Auth-Email': xAuthEmail, 'X-Auth-Key': xAuthKey}}
    try {
        var res = request('GET', 'https://api.cloudflare.com/client/v4/zones/' + zoneID + '/dns_records/' + dnsRecordID, options);
        if (res.statusCode==200){
            var object = JSON.parse(res.getBody().toString());
            return object.result.content;
        }
    } catch(exception){
        log('Exception: getCurrentCloudflareIP ' + exception);
    }
    return null;
}

function getCurrentIP(){
    for (var i=0; i<urls.length; i++){
        try {
            var res = request('GET', urls[i], {timeout: 5000});
        } catch (exception){
            log("Exception: getCurrentIP" + exception);
            continue;
        }
        if (res.statusCode == 200){
            var ipString = (res.getBody().toString());
            ipString = ipString.replace(/^\s+|\s+$/g, '');
            if (new Address4(ipString).isValid()){
                return ipString;
                break;
            } else {
                log('Warning: URL: ' + urls[i] + ' hat keine gueltige IP-Adresse zurückgegeben.');
                continue;
            }
        } else {
            log('Warning: URL: ' + urls[i] + ' gibt folgenden Fehlercode/Fehler zurück: ' + res);
        }
    }
    return null;
}

function updateCloudflareDNSRecord(currentIP){
    log("Info: Update wird durchgefuehrt mit IP " + currentIP);
    var jsonString = "{'id': \"" + dnsRecordID + "\", 'type':\"A\", 'name':\"" + domainName + "\", 'content':\"" + currentIP + "\"}";
    var options = {headers: {'X-Auth-Email': xAuthEmail, 'X-Auth-Key': xAuthKey}, body: jsonString};
    try {
        var res = request('PUT', 'https://api.cloudflare.com/client/v4/zones/' + zoneID + '/dns_records/' + dnsRecordID, options);
        if (res.statusCode == 200){
        } else {
            log("Warning: Fehler in updateCloudflareDNSRecord. Anderer StatusCode als 200 wurde zurückgeliefert: ");
            log(res);
        }
    } catch (exception) {
        log('Exception: updateCloudflareDNSRecord ' + exception.getBody().toString());		// Panic-Mode
    }
}

function log(data){
    console.log(data);
    fs.appendFile('updaterlog.txt', data + ' am ' + new Date().toLocaleString() + '\r\n', function (err) {if (err){console.log(err)}});
}
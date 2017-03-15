const schedule = require('node-schedule');
const request = require("request");
const moment = require("moment");
const fs = require("fs");


const url = "https://api-lab-trall-stif.opendata.stif.info/service/tr-globale-stif/estimated-timetable";
const username = "";
const password = "";

var _stif = JSON.parse(fs.readFileSync('./perimetre-tr-plateforme-stif.json').toString());
var stif = {};

var stif_error = [];
for (var i in _stif) {
	if (_stif[i].fields.codifligne_line_id && _stif[i].fields.reflex_zde_nom && _stif[i].fields.reflex_zde_id) {
		//stif[_stif[i].fields.codifligne_line_id+"::"+_stif[i].fields.reflex_zde_nom+"::"+_stif[i].fields.reflex_zde_id] = _stif[i];
		stif[_stif[i].fields.codifligne_line_id+"::"+_stif[i].fields.reflex_zde_id] = _stif[i];
	} else {
		stif_error.push(_stif[i]);
	}
}

fs.writeFileSync('./stif.json', JSON.stringify(stif));
fs.writeFileSync('./stif_error.json', JSON.stringify(stif_error));
console.log("[STIF_LOADED]", _stif.length-stif_error.length);
console.log("[STIF_ERROR]", stif_error.length);
console.log();

var output = [];

var getRealtimeData = function() {
	console.log("[START]", "@", moment().format("YYYY-MM-DDTHH:mm:ss"));
	request.get(url, {
	  "auth": {
		"user": username,
		"pass": password,
		"sendImmediately": false
	  }
	}, function(error, response, body) {
		if (error) {
			console.log("Error:", error);
		}
		if (body) {
			fs.writeFileSync("./realtime_"+moment().unix()+".json", body);
			var parsed = JSON.parse(body);
			var realtime_total = 0;
			var realtime_error = [];
			var loop1 = function(i1, data1, cb1) {
				if (i1 < data1.length) {
					if (data1[i1].vehicleMode[0]) {
						console.log("[TRIP]", data1[i1].vehicleMode[0], data1[i1].publishedLineName[0].value, "==>", data1[i1].destinationName[0].value);
					} else {
						console.log("[TRIP]", data1[i1].publishedLineName[0].value, "==>", data1[i1].destinationName[0].value);
					}
					var loop2 = function(i2, data2, cb2) {
						if (i2 < data2.length) {

							var splitted = data2[i2].stopPointRef.value.split(":");
							var provider = splitted[0];
							var type = splitted[1];
							var idk = splitted[2];
							var id = splitted[3];

							realtime_total = realtime_total+1;

							/*
							if (stif[data1[i1].lineRef.value+"::"+id] !== undefined) {
								console.log(data2[i2].stopPointRef.value, "==>", data1[i1].lineRef.value, id, "==>", data1[i1].lineRef.value+"::"+id, "==>", stif[data1[i1].lineRef.value+"::"+id].length);
							} else {
								console.log(data2[i2].stopPointRef.value, "==>", data1[i1].lineRef.value, id, "==>", data1[i1].lineRef.value+"::"+id, "==>", stif[data1[i1].lineRef.value+"::"+id]);
								realtime_error.push(data1[i1]);
							}
							*/

							setTimeout(function() {
								return loop2(i2+1, data2, cb2);
							});
						} else {
							return cb2()
						}
					};
					return loop2(0, data1[i1].estimatedCalls.estimatedCall, function() {
						loop1(i1+1, data1, cb1);
					});
				} else {
					return cb1();
				}
			};
			return loop1(0, parsed.siri.serviceDelivery.estimatedTimetableDelivery, function() {
				fs.writeFileSync("./realtime_error_"+moment().unix()+".json", JSON.stringify(realtime_error));
				console.log("[REALTIME_ERROR]", realtime_error.length+"/"+realtime_total, "==>", ((realtime_error.length/realtime_total)*100)+"%");
				console.log("[END]", "@", moment().format("YYYY-MM-DDTHH:mm:ss"), "-", output.length, "stations");
				console.log();
				realtime_error = [];
				output = [];
				realtime_total = 0;
			});
		}
	});
};

getRealtimeData();
var job = schedule.scheduleJob('*/5 * * * *', function(){
	getRealtimeData();
});

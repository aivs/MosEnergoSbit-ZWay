/*** MosEnergoSbit Z-Way HA module *******************************************

Version: 1.0.0
(c) Z-Wave.Me, 2017
-----------------------------------------------------------------------------
Author: Yurkin Vitaliy <aivs@z-wave.me>
Description:
    Send meter readings to Mosenergosbyt
******************************************************************************/

// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------

function MosEnergoSbit (id, controller) {
    // Call superconstructor first (AutomationModule)
    MosEnergoSbit.super_.call(this, id, controller);
    
    this.lastViewState = "";
}

inherits(MosEnergoSbit, AutomationModule);

_module = MosEnergoSbit;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

MosEnergoSbit.prototype.init = function (config) {
    MosEnergoSbit.super_.prototype.init.call(this, config);

    var self = this;

    this.handler = function (vDev) {
        // ************************ Login to Mosenergosbyt in 3 steps ****************************//
        var cookieObject = {};

        response = http.request({
            method: 'GET',
            url: "https://lkkbyt.mosenergosbyt.ru/common/login.xhtml"
        });
        cookieObject = http.saveCookie(response, cookieObject);
        self.getViewState(response);
        var loginRnd = self.getLoginRnd(response);

        response = http.request({
            method: 'POST',
            url: "https://lkkbyt.mosenergosbyt.ru/common/login.xhtml",
            headers: {
                "Cookie": http.loadCookie(cookieObject)
            },
            data: {
                "lb_login:f_login:rnd": loginRnd,
                "lb_login:f_login:t_login": self.config.login,
                "lb_login:f_login:t_pwd": self.config.password,
                "lb_login:f_login_SUBMIT": "1",
                "javax.faces.ViewState": self.lastViewState,
                "lb_login:f_login:_idcl": "lb_login:f_login:l_submit"
            }
        });
        cookieObject = http.saveCookie(response, cookieObject);
        
        response = http.request({
            method: 'GET',
            url: "https://lkkbyt.mosenergosbyt.ru/abonent/index.xhtml",
            headers: {
                "Cookie": http.loadCookie(cookieObject)
            }
        });
        cookieObject = http.saveCookie(response, cookieObject);
        self.getViewState(response);
        
        // ******************************* Get the cost ************************** //
        response = http.request({
            method: 'POST',
            url: "https://lkkbyt.mosenergosbyt.ru/abonent/index.xhtml",
            headers: {
                "Cookie": http.loadCookie(cookieObject),
                "Faces-Request": "partial/ajax",
                "X-Requested-With": "XMLHttpRequest"
            },
            data: {
                "javax.faces.partial.ajax":"true",
                "javax.faces.source":"f_transfer:cm_transf",
                "javax.faces.partial.execute":"@all",
                "f_transfer:cm_transf":"f_transfer:cm_transf",
                "f_transfer:vl_t1":"51632",
                "f_transfer_SUBMIT":"1",
                "javax.faces.ViewState":self.lastViewState
            }
        });
        var cookieObject = http.saveCookie(response, cookieObject);
        self.getViewState(response);

        self.vDevMeter.set("metrics:level", vDev.get("metrics:level"));
    };

    this.createMosEnergoSbitDev = function () {
        self.vDevMeter = self.controller.devices.create({
            deviceId: "MosEnergoSbit_" + self.id,
            defaults: {
                deviceType: "sensorMultilevel",
                metrics: {
                    scaleTitle: "₽",
                    level: 0.0,
                    icon: "/ZAutomation/api/v1/load/modulemedia/MosEnergoSbit/icon.png",
                    title: "Сумма начислений " + self.config.login
                }
            },
            overlay: {},
            moduleId: self.id
        });

        // Start handler by cron
        self.controller.devices.on(self.config.meter, 'change:metrics:level', self.handler);
    };

    this.meterCreated = function (vDev) {
        if (vDev.id === self.config.meter) {
            self.createMosEnergoSbitDev();
        }
    };

    this.meterRemoved = function (vDev) {
        if (vDev.id === self.controller.devices.get(self.config.meter)) {
            self.controller.devices.remove("MosEnergoSbit_" + self.id);
        }
    };

    // Bind to event "Added new meter" -- > Bind to new device
    this.controller.devices.on('created', this.meterCreated);   

    // Bind to event "Removed meter" --> Unbind device
    this.controller.devices.on('removed', this.meterRemoved); 

    if (this.controller.devices.get(this.config.meter)) {
        self.createMosEnergoSbitDev();
    }
};

MosEnergoSbit.prototype.stop = function () {
    this.controller.devices.off(this.config.meter, 'change:metrics:level', this.handler);
    this.controller.devices.remove("MosEnergoSbit_" + this.id);

    MosEnergoSbit.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------
http.saveCookie = function(response, cookieObject) {
    // Transform cookie string to object
    response.headers["Set-Cookie"].split(";").forEach(function(item, i, arr) {
        if ((item.indexOf("path") == -1) && (item.indexOf("secure") == -1) && (item.indexOf("HttpOnly") == -1 && (item.indexOf("expires")) == -1 && item !== "")) {
            var elementArray = item.split("=");
            cookieObject[elementArray[0]] = elementArray[1];
        }
    });
    return cookieObject;
};

http.loadCookie = function(cookieObject) {
    // Transform cookie object to string
    var cookie = "";
    Object.keys(cookieObject).forEach(function(item, i, arr) {
        cookie = cookie + item + "=" + cookieObject[item] + ";";
    });
    return cookie;
};

MosEnergoSbit.prototype.getViewState = function(response) {
    var self = this;

    var data = response.data.toString();
    var javaxfacesViewState1 = "javax.faces.ViewState\" value=";
    var javaxfacesViewState2 = "javax.faces.ViewState\">";
    var javaxfacesViewState3 = "[CDATA";
    if (data.indexOf(javaxfacesViewState1) !== -1) {
        var endOfJavaxfacesViewState = data.indexOf(javaxfacesViewState1) + javaxfacesViewState1.length + 1;
        self.lastViewState = data.substring(endOfJavaxfacesViewState, data.indexOf("\"", endOfJavaxfacesViewState));
    }
    else if (data.indexOf(javaxfacesViewState2) !== -1) {
        var endOfJavaxfacesViewState = data.indexOf(javaxfacesViewState2) + javaxfacesViewState2.length + 1;
        self.lastViewState = data.substring(endOfJavaxfacesViewState, data.indexOf("\<", endOfJavaxfacesViewState));
    }
};

MosEnergoSbit.prototype.getLoginRnd = function(data) {
    var self = this;

    var data = response.data.toString();
    var fLoginRnd = "";
    var lbLoginFLoginRnd = "lb_login:f_login:rnd\" value=";
    if (data.indexOf(lbLoginFLoginRnd) !== -1) {
        var endOfLbLoginFLoginRnd = response.data.indexOf(lbLoginFLoginRnd) + lbLoginFLoginRnd.length + 1;
        fLoginRnd = response.data.substring(endOfLbLoginFLoginRnd, response.data.indexOf("\"", endOfLbLoginFLoginRnd));
    }
    return fLoginRnd;
};

"use strict";
var Micro;
(function (Micro) {
    Micro.exec = (script) => {
        const elem = document.createElement("script");
        elem.textContent = script;
        document.body.prepend(elem);
        elem.remove();
    };
})(Micro || (Micro = {}));

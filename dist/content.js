"use strict";
const exec = (script) => {
    const elem = document.createElement("script");
    elem.textContent = script;
    document.body.prepend(elem);
    elem.remove();
};

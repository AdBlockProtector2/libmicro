// See background.ts for more information
"use strict";

const exec = (script: string): void => {
    const elem: HTMLElement = document.createElement("script");
    elem.textContent = script;
    // @ts-ignore Every browser has it
    document.body.prepend(elem);
    elem.remove();
};

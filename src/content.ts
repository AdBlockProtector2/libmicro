// This script is the content script of libmicro
// See background.ts for more information
"use strict";

/**
 * libmicro main namespace.
 * @namespace
 */
namespace Micro {
    /**
     * Execute code in page script scope.
     * @function
     * @param script - The payload.
     */
    export const exec = (script: string): void => {
        const elem: HTMLElement = document.createElement("script");
        elem.textContent = script;
        // @ts-ignore Every browser has it
        document.body.prepend(elem);
        elem.remove();
    };
}

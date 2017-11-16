"use strict";

(async () => {

    // libmicro use Adblock Plus style filter lists, with a
    // few differences
    //
    // libmicro does not parse white lists as it is designed to assist
    // a main firewall, instead of taking the whole task itself
    //
    // Some options Adblock Plus supports are not accepted by libmicro
    // and vice versa, play around with it to find out the difference
    //
    // The filtering logic is also somewhat different, filters will
    // not work out of the box, a transpiler is expected
    await Micro.setConfig(`
||example.com^$image
||example.com^$document,redirect=testpage
`);

    // libmicro use uBlock Origin scriptlet resources
    await Micro.setAssets(`
testpage text/html
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
</head>
<body>
  <h1>Test Test</h1>
</body>
</html>
`);

    // setConfig and setAssets can run in parallel, but you must
    // wait for both of them to complete before calling init

    // setConfig and setAssets persist across browser restarts,
    // but are not synced across connected devices

    await Micro.init();

})();

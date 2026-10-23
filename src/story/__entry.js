const params = new URLSearchParams(location.search);
if (params.get("cast")) import("./__cast.js");
else import("./__dev.js");

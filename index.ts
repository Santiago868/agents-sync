import figlet from "figlet";



const server = Bun.serve({
  port: 3000,
  routes: {
    "/": () => new Response('Bun!'),
    "/figlet": () => { 
      const body = figlet.textSync("Config Hub", {
        font: "Standard",
        horizontalLayout: "default",
        verticalLayout: "default",
      }); 
      return new Response(body); 
    } 
  }
});

console.log(`Listening on ${server.url}`);

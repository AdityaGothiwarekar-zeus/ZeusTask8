const fs = require("fs"); // Import file system module

let users = [];

for (let i = 0; i < 20; i++) {
  users.push({
    id: i,
    firstname: `first${i}`,
    lastname: `last${i}`,
    age: i,
    salary: `3000${i}`,
  });
}

// Save to name.json
fs.writeFileSync("name.json", JSON.stringify(users, null, 2), "utf8");

console.log("User data saved to name.json");

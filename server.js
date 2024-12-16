import express from "express";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { fileURLToPath } from "url";
import { resourceUsage } from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();


const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_COLLECTION,
};
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.qh54p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, { autoSelectFamily: false });


const apiUrl = "https://chinese-food-db.p.rapidapi.com/";
const apiOptions = {
  method: "GET",
  headers: {
    "x-rapidapi-key": '7f44c4cc67mshe367feb8999fca6p16a255jsnea7072e27288', 
    "x-rapidapi-host": "chinese-food-db.p.rapidapi.com",
  },
};

async function fetchAndSaveRecipes() {
  try {
    const response = await fetch(apiUrl, apiOptions);
    if (!response.ok) throw new Error(`Error: ${response.statusText}`);
    const result = await response.json(); 


    fs.writeFile("recipes.json", JSON.stringify(result), (err) => {
      if (err) throw err;
      console.log("**Recipes saved to recipes.json**");
    });

    return JSON.stringify(result); 
  } catch (error) {
    console.error("Error fetching recipes:", error);
  }
}
const recipes = await fetchAndSaveRecipes();





app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

console.log(`Web server started and running at http://localhost:4000`);

const prompt1 = "Stop to shutdown the server: \n";
process.stdout.write(prompt1);
process.stdin.on("readable", function () {
  const dataInput = process.stdin.read();
  if (dataInput !== null) {
    const command = dataInput.toString().trim();
    if (command === "stop") {
      process.stdout.write("Shutting down the server\n");
      process.exit(0);
    }
  }
});

app.use(bodyParser.urlencoded({ extended: false }));


app.get("/", async (req, res) => {
  res.render("index.ejs", {recipes:recipes});
});

app.get("/order", (req, res) => {
  res.render("order.ejs");
});

app.get("/retrieveRecipe", async (req, res) => {
  res.render("retrieveRecipe.ejs");
});


app.post("/orderConfirmation", async (req, res) => {
  let list = JSON.parse(recipes);
  let recipeTitle;
  let recipeImage;
  
  list.forEach(entry => {
    if(entry.id === req.body.recipeID){
      recipeTitle = entry.title;
      recipeImage = entry.image;
    }
  });
  
  const variables = {
    name: req.body.name,
    email: req.body.email,
    recipeID: req.body.recipeID,
    title: recipeTitle,
    image: recipeImage
  };

  try {
    await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .insertOne(variables);
    res.render("orderConfirmation.ejs", variables);
  } catch (err) {
    console.error("Error saving to MongoDB:", err);
    res.status(500); 
    res.send("Error saving to database.");
  }
});

app.post("/displayRecipe", async (req, res) => {
  try {
    const filter = { email: req.body.email };
    const userRecipes = await client.db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .find(filter)
      .toArray();

    const recipesWithDetails = await Promise.all(userRecipes.map(async (entry) => {
      try {
        const response = await fetch(
          `https://chinese-food-db.p.rapidapi.com/${entry.recipeID}`,
          {
            method: 'GET',
            headers: {
              'x-rapidapi-key': 'd03c9f7fe9msh985faa98e181148p15757fjsn7baa9796383e',
              'x-rapidapi-host': 'chinese-food-db.p.rapidapi.com',
            },
          }
        );
        const recipeDetails = await response.json();
        return { ...entry, details: recipeDetails };
      } catch (error) {
        console.error(`Error fetching details for Recipe ID ${entry.recipeID}:`, error);
        return { ...entry, details: null };
      }
    }));

    res.render("displayRecipe.ejs", { recipesWithDetails });
  } catch (error) {
    console.error("Error retrieving recipes:", error);
    res.status(500).send("Error occurred while retrieving recipes.");
  }
});



app.listen(4000);

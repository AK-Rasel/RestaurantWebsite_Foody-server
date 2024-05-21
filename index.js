const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.SECRET_STRIPE_KEY);

// console.log(process.env.SECRET_STRIPE_KEY);

const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

// middle ware
app.use(cors());
app.use(express.json());

// mongodb config

const uri = `mongodb+srv://${process.env.SECRET_UserName}:${process.env.SECRET_Password}@cluster0.mc1hfkb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // start our  code

    // database Collection------------------
    const menuCollections = client.db("foody-client-db").collection("menus");
    const cartCollections = client
      .db("foody-client-db")
      .collection("cartsItems");
    const userCollection = client.db("foody-client-db").collection("users");
    const paymentCollection = client
      .db("foody-client-db")
      .collection("payment");

    // JWT-token-Generator ---start
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: 60 * 60,
      });
      res.send({ token });
    });
    // verify jwt token
    // middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log(token);
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "token is invalid" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // JWT ---end
    // admin verify
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role == "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access!" });
      }
      next();
    };

    // all menus items operations--------------------
    app.get("/menu", async (req, res) => {
      const result = await menuCollections
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });
    // specific menu item
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id; // Extract the id from params
      const filterId = { _id: new ObjectId(id) }; // Create the filter using the ObjectId

      try {
        const menu = await menuCollections.findOne(filterId);
        if (menu) {
          res.status(200).json(menu);
        } else {
          res.status(404).json({ message: "Menu item not found" });
        }
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    app.post("/menu", async (req, res) => {
      const newItem = req.body;
      // Add the current date and time to the newItem object
      newItem.createdAt = new Date();
      try {
        const result = await menuCollections.insertOne(newItem);
        res.status(200).json(result);
      } catch (error) {
        res.status.apply(500).json({ message: error.message });
      }
    });
    app.put("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const menuItem = req.body;
      const filterId = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: menuItem.name,
          recipe: menuItem.recipe,
          image: menuItem.image,
          category: menuItem.category,
          price: menuItem.price,
        },
      };
      // console.log(updateDoc);
      try {
        const result = await menuCollections.updateOne(filterId, updateDoc);
        // console.log(menuItem);
        if (result.matchedCount === 0) {
          return res.status(404).json("Menu not found");
        }
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    app.delete("/menu/:id", async (req, res) => {
      const id = req.params;
      const filterId = { _id: new ObjectId(id) };
      try {
        const deleteItem = await menuCollections.deleteOne(filterId);
        if (deleteItem.deletedCount === 1) {
          res.status(200).json({ message: "deleted successFully" });
        } else {
          res.status(404).json({ message: "Item not found" });
        }
      } catch (error) {
        res.status(500).json({ message: "Error deleting document", error });
      }
    });

    // Curd Operation------------------------------
    app.post("/carts", async (req, res) => {
      const cartItems = req.body;
      const result = await cartCollections.insertOne(cartItems);
      res.send(result);
    });

    //get cart using email
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await cartCollections.find(filter).toArray();
      res.send(result);
    });
    // cart route section--------------------------------------------start
    // get specific carts
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollections.findOne(filter);
      res.send(result);
    });
    // delete from cart items
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollections.deleteOne(filter);
      res.send(result);
    });

    // cart update with quantity
    app.put("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: { quantity: parseInt(quantity, 10) },
      };
      const result = await cartCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // cart route section--------------------------------------------end
    // user route start----------------
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const uses = await userCollection.find({}).toArray();
        res.status(200).json(uses);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    // new user create
    app.post("/users", async (req, res) => {
      const { name, role, email, photoURL } = req.body;
      const newUser = { name, role, email, photoURL };
      const queryEmail = { email: email };
      try {
        const existingUser = await userCollection.findOne(queryEmail);
        if (existingUser) {
          return res.status(302).json({ message: "User already exists" });
        }
        const result = await userCollection.insertOne(newUser);
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // user delete
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const userId = req.params.id;
        const paramsId = { _id: new ObjectId(userId) };
        const result = await userCollection.deleteOne(paramsId);
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ message: "User deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    // get admin
    app.get(
      "/users/admin/:email",
      verifyToken,

      async (req, res) => {
        try {
          const email = req.params.email;
          const emailQuery = { email: email };
          const user = await userCollection.findOne(emailQuery);
          // console.log(user);
          // console.log(email);
          // console.log(req.decoded.email);
          if (email !== req.decoded.email) {
            return res.status(403).send({ message: "Forbidden access" });
          }
          let admin = false;
          if (user) {
            admin = user?.role === "admin";
          }
          res.status(200).json({ admin });
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
    );

    // make admin
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const userId = req.params.id;
          const filter = { _id: new ObjectId(userId) };
          const option = { upsert: true };
          console.log(userId);
          const { role } = req.body;
          const updateDoc = {
            $set: {
              role: "admin",
            },
          };
          const updateUser = await userCollection.updateOne(
            filter,
            updateDoc,
            option
          );
          if (!updateUser) {
            return res.status(404).json({ messages: "User not found" });
          }

          res.status(200).json(updateUser);
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      }
    );

    // payment info backend
    app.post("/payment", verifyToken, async (req, res) => {
      const paymentInfo = req.body;
      // Add the current date and time to the newItem object
      paymentInfo.createdAt = new Date();
      try {
        const paymentRequest = await paymentCollection.insertOne(paymentInfo);
        // delete cart items
        const cartIds = paymentInfo.cartItem.map((id) => new ObjectId(id));
        const deleteCartRequest = await cartCollections.deleteMany({
          _id: { $in: cartIds },
        });
        res.status(200).json({ paymentRequest, deleteCartRequest });
      } catch (error) {
        res.status.apply(404).json({ message: error.message });
      }
    });

    app.get("/payment", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const decodedEmail = req.decoded.email;
      try {
        if (email !== decodedEmail) {
          res.status(403).json({ message: "Forbidden Access" });
        }
        const result = await paymentCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status.apply(404).json({ message: error.message });
      }
    });

    // user route end----------------
    // stripe Payment
    // Create a PaymentIntent with the order amount and currency
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(400).send({
          error: error.message,
        });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

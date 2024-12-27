import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import pgSession from "connect-pg-simple";

import dotenv from "dotenv";
dotenv.config();
import { sendMail } from "./mail.js";
import bcrypt from "bcrypt";
import session from "express-session";
import { Strategy } from "passport-local";
import passport from "passport";

const app = express();
const port = 3000;
const db = new pg.Client({
  user: process.env.DB_OWNER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const saltRounds = 10;

console.log(typeof process.env.SESSION_SECRET);
const pgStore = pgSession(session);

app.use(
  session({
    store: new pgStore({
      pool: db,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

async function checkUserExists(email) {
  const result = await db.query("SELECT * FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  console.log(result.rows);
  return result.rows.length > 0;
} // checkUserExists

async function checkUserLogin(email) {
  const result = await db.query("SELECT * FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  console.log(result.rows);
  return result.rows;
}
app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/secrets", async (req, res) => {
  if (req.isAuthenticated()) {
    const username = req.user;
    const userExists = await checkUserExists(username);

    if (userExists) {
      res.render("secrets.ejs", { username });
    } else {
      req.logout((err) => {
        if (err) {
          console.error(err);
        }
        res.redirect("/login");
      });
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  const username = req.user;
  if (req.isAuthenticated()) {
    res.redirect("/secrets");
  } else {
    res.render("login.ejs");
  }
});

app.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/secrets");
  } else {
    const message = req.query.message || "";
    res.render("register.ejs", { message });
  }
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  let message = "";
  if (!username || !username.trim() || !password || !password.trim()) {
    message = "invalid input. Please provide both username and password.";
    res.render("register.ejs", { message });

    return;
  }
  try {
    if (await checkUserExists(username)) {
      message = "Username already exists";
      res.render("register.ejs", { message });
      return;
    }

    bcrypt.hash(password, saltRounds, async (err, hash) => {
      if (err) {
        console.error(err);
        return;
      }

      const result = await db.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
        [username.toLowerCase(), hash]
      );
      const newUser = result.rows[0];

      console.log("Registered user:", newUser);

      const pdfFilePath = "./public/doulingo.pdf"; // Adjust the path to your file
      await sendMail(
        newUser.email,
        "Welcome to Our Platform!",
        { username: newUser.email },
        pdfFilePath
      );

      console.log("Email sent successfully!");
    });

    req.login(username, (err) => {
      if (err) {
        console.error(err);
      } else {
        res.redirect("/secrets");
      }
    });
  } catch (error) {
    console.error(err);
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      if (await checkUserExists(username)) {
        const result = await checkUserLogin(username);
        console.log(result[0].password);
        bcrypt.compare(password, result[0].password, (err, result) => {
          if (err) {
            console.error(err);
            return cb(err);
          } else if (result) {
            console.log("Login successful!");

            return cb(null, username);
          } else {
            return cb("Incorrect Password");
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.error(err);
    }
  })
);

passport.serializeUser((username, cb) => {
  cb(null, username);
});
passport.deserializeUser((username, cb) => {
  cb(null, username);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

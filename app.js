const express = require("express");

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const path = require("path");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,

      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log(`Server Running at localhost:3000`);
    });
  } catch (e) {
    console.log(`DB ERROR ${e.message}`);
  }
};

initializeDBAndServer();

const authenticationToken = (request, response, next) => {
  let jwtToken;

  const authToken = request.headers["authorization"];

  // console.log(authToken);

  if (authToken !== undefined) {
    jwtToken = authToken.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);

    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_CODE", async (error, payload) => {
      if (error) {
        response.status(401);

        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;

        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  // console.log(hashedPassword);

  const getUserQuery = `

SELECT * from user where username="${username}";`;

  const user = await db.get(getUserQuery);

  if (user === undefined) {
    if (password.length >= 6) {
      const createUserQuery = `

INSERT INTO user(username,password,name,gender)

VALUES("${username}","${hashedPassword}","${name}","${gender}");`;

      const createdUser = await db.run(createUserQuery);

      response.send("User created successfully");
    } else {
      response.status(400);

      response.send("Password is too short");
    }
  } else {
    response.status(400);

    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUserQuery = `

SELECT * FROM user WHERE username="${username}";`;

  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);

    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      console.log(dbUser.user_id);

      const payload = { username: dbUser.username };

      console.log(payload);

      const jwtToken = jwt.sign(payload, "MY_SECRET_CODE");

      response.send({ jwtToken });
    } else {
      response.status(400);

      response.send("Invalid password");
    }
  }
});

app.get(
  "/user/tweets/feed/",

  authenticationToken,

  async (request, response) => {
    const username = request.username;

    const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

    const user1 = await db.get(getuserIdQuery);

    // console.log(user1.user_id);

    const getTweetsQuery = `

SELECT T.username,tweet.tweet,tweet.date_time as dateTime from (user inner join follower on user.user_id=follower.following_user_id )as T

inner join tweet on T.following_user_id=tweet.user_id

where T.follower_user_id=${user1.user_id}

order by dateTime DESC

LIMIT 4;`;

    const user = await db.all(getTweetsQuery);

    response.send(user);
  }
);

app.get("/user/following/", authenticationToken, async (request, response) => {
  const username = request.username;

  const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

  const user1 = await db.get(getuserIdQuery);

  const getTweetsQuery = `

SELECT user.name from (user inner join follower on user.user_id=follower.following_user_id )

where follower.follower_user_id=${user1.user_id};`;

  const user = await db.all(getTweetsQuery);

  response.send(user);
});

app.get("/user/followers/", authenticationToken, async (request, response) => {
  const username = request.username;

  const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

  const user1 = await db.get(getuserIdQuery);

  const getTweetsQuery = `

SELECT user.name from (user inner join follower on user.user_id=follower.follower_user_id )

where follower.following_user_id=${user1.user_id};`;

  const user = await db.all(getTweetsQuery);

  response.send(user);
});

app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const username = request.username;

  const { tweetId } = request.params;

  const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

  const user1 = await db.get(getuserIdQuery);

  // console.log(user1.user_id);

  const getTweetsQuery = `

SELECT B.tweet,count(DISTINCT B.like_id) as likes,count(DISTINCT reply.reply_id) as replies,tweet.date_time as dateTime from (((user inner join follower on user.user_id=follower.following_user_id )as T

inner join tweet on T.following_user_id=tweet.user_id) as A left join like on like.tweet_id=A.tweet_id)as B left join reply on reply.tweet_id=B.tweet_id

where B.follower_user_id=${user1.user_id} and B.tweet_id=${tweetId};`;

  const user = await db.get(getTweetsQuery);

  if (user.tweet === null) {
    response.status(401);

    response.send("Invalid Request");
  } else {
    response.send(user);
  }
});

app.get(
  "/tweets/:tweetId/likes",

  authenticationToken,

  async (request, response) => {
    const username = request.username;

    const { tweetId } = request.params;

    const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

    const user1 = await db.get(getuserIdQuery);

    // console.log(user1.user_id);

    const getTweetsQuery = `

SELECT like.user_id from ((user inner join follower on user.user_id=follower.following_user_id )as T

inner join tweet on T.following_user_id=tweet.user_id) as A left join like on like.tweet_id=A.tweet_id

where A.follower_user_id=${user1.user_id} and like.tweet_id=${tweetId};`;

    const user = await db.all(getTweetsQuery);

    if (user.length === 0) {
      response.status(401);

      response.send("Invalid Request");
    } else {
      let usernameArr = [];

      for (let i of user) {
        let getUsernameQuery = `SELECT username from user where user_id=${i.user_id};`;

        let user = await db.get(getUsernameQuery);

        // console.log(user.username)

        usernameArr.push(user.username);
      }

      response.send({ likes: usernameArr });
    }
  }
);

app.get(
  "/tweets/:tweetId/replies",

  authenticationToken,

  async (request, response) => {
    const username = request.username;

    const { tweetId } = request.params;

    const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

    const user1 = await db.get(getuserIdQuery);

    // console.log(user1.user_id);

    const getTweetsQuery = `

SELECT reply.user_id,reply.reply from ((user inner join follower on user.user_id=follower.following_user_id )as T

inner join tweet on T.following_user_id=tweet.user_id) as A left join reply on reply.tweet_id=A.tweet_id

where A.follower_user_id=${user1.user_id} and reply.tweet_id=${tweetId}
order by reply.user_id;`;

    const user = await db.all(getTweetsQuery);

    console.log(user);

    if (user.length === 0) {
      response.status(401);

      response.send("Invalid Request");
    } else {
      let repliesArr = [];

      // console.log(user.reply, user.user_id);

      for (let i of user) {
        let usernameArr = {};

        let getUsernameQuery = `SELECT name from user where user_id=${i.user_id};`;

        let User = await db.get(getUsernameQuery);

        // console.log(user.username)

        usernameArr["name"] = User.name;

        usernameArr["reply"] = i.reply;

        repliesArr.push(usernameArr);
      }

      response.send({ replies: repliesArr });
    }
  }
);

app.get("/user/tweets", authenticationToken, async (request, response) => {
  const username = request.username;

  const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

  const user1 = await db.get(getuserIdQuery);

  // console.log(user1.user_id);

  const getTweetsQuery = `

SELECT B.tweet,count(DISTINCT B.like_id) as likes,count(DISTINCT reply.reply_id) as replies,tweet.date_time as dateTime from ((user inner join tweet on user.user_id=tweet.user_id )

as A left join like on like.tweet_id=A.tweet_id)as B left join reply on reply.tweet_id=B.tweet_id

where B.user_id=${user1.user_id}

GROUP by B.tweet_id;`;

  const user = await db.all(getTweetsQuery);

  response.send(user);
});

app.post("/user/tweets", authenticationToken, async (request, response) => {
  const { tweet } = request.body;

  const username = request.username;

  const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

  const user1 = await db.get(getuserIdQuery);

  let dateNow = new Date();

  let month = dateNow.getMonth() + 1;

  dateNow =
    dateNow.getFullYear() +
    "-" +
    month +
    "-" +
    dateNow.getDate() +
    " " +
    dateNow.getHours() +
    ":" +
    dateNow.getMinutes() +
    ":" +
    dateNow.getSeconds();

  const CreateTweetQuery = `

INSERT INTO tweet(tweet,user_id,date_time)

VALUES("${tweet}",${user1.user_id},"${dateNow}");`;

  const created = await db.run(CreateTweetQuery);

  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",

  authenticationToken,

  async (request, response) => {
    const username = request.username;

    const { tweetId } = request.params;

    const getuserIdQuery = `

SELECT user_id from user where username="${username}";`;

    const user1 = await db.get(getuserIdQuery);

    const selectTweetQuery = `SELECT * FROM tweet where user_id=${user1.user_id} and tweet_id=${tweetId};`;

    const selectedTweet = await db.get(selectTweetQuery);

    if (selectedTweet === undefined) {
      response.status(401);

      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `DELETE FROM TWEET where user_id=${user1.user_id} and tweet_id=${tweetId}`;

      const deletedTweet = await db.run(deleteTweetQuery);

      response.send("Tweet Removed");
    }
  }
);

module.exports = app;

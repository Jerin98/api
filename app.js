const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
// route modules
const { mongoose } = require('./db/mongoose');

const bodyParser = require('body-parser');

const { List, Task, User,Timetable,Ttask } = require('./db/models');


const jwt = require('jsonwebtoken');


// middleware
app.use(bodyParser.json());


// cors
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");
    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
    );
    next();
})
let authenticate = (req, res, next) => {
    let token = req.header('x-access-token');

    jwt.verify(token,User.getJWTSecret(),(err, decoded) => {
        if (err) {
            // there was an error
            // jwt is invalid - * DO NOT AUTHENTICATE *
            res.status(401).send(err);
        } else {
            // jwt is valid
            req.user_id = decoded._id;
            next();
        }
    });
}



// verify refresh token middleware
let verifySession = (req, res, next) => {
    // grab the refresh token from the request header
    let refreshToken = req.header('x-refresh-token');

    // grab the _id from the request header
    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if (!user) {
            // user couldn't be found
            return Promise.reject({
                'error': 'User not found. Make sure that the refresh token and user id are correct'
            });
        }


        // if the code reaches here - the user was found
        // therefore the refresh token exists in the database - but we still have to check if it has expired or not

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;

        user.sessions.forEach((session) => {
            if (session.token === refreshToken) {
                // check if the session has expired
                if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    // refresh token has not expired
                    isSessionValid = true;
                }
            }
        });

        if (isSessionValid) {
            // the session is VALID - call next() to continue with processing this web request
            next();
        } else {
            // the session is not valid
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid'
            })
        }

    }).catch((e) => {
        res.status(401).send(e);
    })
}

// route handlers

app.get('/lists',authenticate,(req,res)=>{
 List.find({
     _userId: req.user_id
 }).then((lists)=>{
     res.send(lists);
 })
 .catch((e) => {
    res.send(e);
});
})
app.get('/timetables',authenticate,(req,res)=>{
    Timetable.find({
        
        _userId: req.user_id
       
    }).then((timetables)=>{
        res.send(timetables);
    })
    .catch((e) => {
       res.send(e);
   });
   })
app.post('/lists',authenticate,(req,res)=>{
   let title = req.body.title;
   let newList = new List({
       title,
       _userId: req.user_id
   });
   newList.save().then((listDoc)=>{
    //    full list doc
    res.send(listDoc);
   })
  });
  app.post('/timetables',authenticate,(req,res)=>{
    let title = req.body.title;
    let newTimetable = new Timetable({
        title,
        
        _userId: req.user_id
        
    });
    newTimetable.save().then((timetableDoc)=>{
     
     res.send(timetableDoc);
    })
   });


  app.patch('/lists/:id',authenticate,(req,res)=>{
    List.findOneAndUpdate({ _id: req.params.id,_userId: req.user_id},{
      $set:req.body
    }).then(() => {
        res.sendStatus({'message':'updated'});
    });
  })
  app.patch('/timetables/:id',authenticate,(req,res)=>{
    Timetable.findOneAndUpdate({ _id: req.params.id,_userId: req.user_id},{
      $set:req.body
    }).then(() => {
        res.sendStatus({'message':'updated'});
    });
  })
  app.delete('/timetables/:id',authenticate,(req,res)=>{
    Timetable.findOneAndRemove({
        _id: req.params.id,
        _userId: req.user_id
    }).then((removedTimetableDoc) => {
        res.send(removedTimetableDoc);
        // delete all the tasks that are in the deleted list
        deleteTtasksFromTimetable(removedTimetableDoc._id);
    });
  })
  app.delete('/lists/:id',authenticate,(req,res)=>{
    List.findOneAndRemove({
        _id: req.params.id,
        _userId: req.user_id
    }).then((removedListDoc) => {
        res.send(removedListDoc);
        // delete all the tasks that are in the deleted list
        deleteTasksFromList(removedListDoc._id);
    });
  })
  app.get('/lists/:listId/tasks',authenticate,  (req, res) => {
    // We want to return all tasks that belong to a specific list (specified by listId)
    Task.find({
        _listId: req.params.listId
    }).then((tasks) => {
        res.send(tasks);
    })
});
app.get('/timetables/:timetableId/ttasks',authenticate,  (req, res) => {
    // We want to return all tasks that belong to a specific list (specified by listId)
    Ttask.find({
        _timetableId: req.params.timetableId
    }).then((ttasks) => {
        res.send(ttasks);
    })
});


app.post('/lists/:listId/tasks',authenticate, (req, res) => {
    // We want to create a new task in a list specified by listId

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if (list) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can create new tasks
            return true;
        }

        // else - the list object is undefined
        return false;
    }).then((canCreateTask) => {
        if (canCreateTask) {
            let newTask = new Task({
                title: req.body.title,
                _listId: req.params.listId
            });
            newTask.save().then((newTaskDoc) => {
                res.send(newTaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    })
})
app.post('/timetables/:timetableId/ttasks',authenticate, (req, res) => {
    // We want to create a new task in a list specified by listId

    Timetable.findOne({
        _id: req.params.timetableId,
        _userId: req.user_id
    }).then((timetable) => {
        if (timetable) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can create new tasks
            return true;
        }

        // else - the list object is undefined
        return false;
    }).then((canCreateTtask) => {
        if (canCreateTtask) {
            let newTtask = new Ttask({
                title: req.body.title,
                _timetableId: req.params.timetableId
            });
            newTtask.save().then((newTtaskDoc) => {
                res.send(newTtaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    })
})
app.patch('/lists/:listId/tasks/:taskId',authenticate,  (req, res) => {
    // We want to update an existing task (specified by taskId)

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if (list) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can make updates to tasks within this list
            return true;
        }

        // else - the list object is undefined
        return false;
    }).then((canUpdateTasks) => {
        if (canUpdateTasks) {
            // the currently authenticated user can update tasks
            Task.findOneAndUpdate({
                _id: req.params.taskId,
                _listId: req.params.listId
            }, {
                    $set: req.body
                }
            ).then(() => {
                res.send({ message: 'Updated successfully.' })
            })
        } else {
            res.sendStatus(404);
        }
    })
});
app.patch('/timetables/:timetableId/ttasks/:ttaskId',authenticate,  (req, res) => {
    // We want to update an existing task (specified by taskId)

    Timetable.findOne({
        _id: req.params.timetableId,
        _userId: req.user_id
    }).then((timetable) => {
        if (timetable) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can make updates to tasks within this list
            return true;
        }

        // else - the list object is undefined
        return false;
    }).then((canUpdateTtasks) => {
        if (canUpdateTtasks) {
            // the currently authenticated user can update tasks
            Ttask.findOneAndUpdate({
                _id: req.params.ttaskId,
                _timetableId: req.params.timetableId
            }, {
                    $set: req.body
                }
            ).then(() => {
                res.send({ message: 'Updated successfully.' })
            })
        } else {
            res.sendStatus(404);
        }
    })
});
app.delete('/lists/:listId/tasks/:taskId',authenticate, (req, res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if (list) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can make updates to tasks within this list
            return true;
        }

        // else - the list object is undefined
        return false;
    }).then((canDeleteTasks) => {
        
        if (canDeleteTasks) {
            Task.findOneAndRemove({
                _id: req.params.taskId,
                _listId: req.params.listId
            }).then((removedTaskDoc) => {
                res.send(removedTaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    });
});
app.delete('/timetables/:timetableId/ttasks/:ttaskId',authenticate, (req, res) => {

    Timetable.findOne({
        _id: req.params.timetableId,
        _userId: req.user_id
    }).then((timetable) => {
        if (timetable) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can make updates to tasks within this list
            return true;
        }

        // else - the list object is undefined
        return false;
    }).then((canDeleteTtasks) => {
        
        if (canDeleteTtasks) {
            Ttask.findOneAndRemove({
                _id: req.params.ttaskId,
                _timetableId: req.params.timetableId
            }).then((removedTtaskDoc) => {
                res.send(removedTtaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    });
});

/* USER ROUTES */

/**
 * POST /users
 * Purpose: Sign up
 */
app.post('/users', (req, res) => {
    // User sign up

    let body = req.body;
    let newUser = new User(body);

    newUser.save().then(() => {
        return newUser.createSession();
    }).then((refreshToken) => {
        // Session created successfully - refreshToken returned.
        // now we geneate an access auth token for the user

        return newUser.generateAccessAuthToken().then((accessToken) => {
            // access auth token generated successfully, now we return an object containing the auth tokens
            return { accessToken, refreshToken }
        });
    }).then((authTokens) => {
        // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
        res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
            .send(newUser);
    }).catch((e) => {
        res.status(400).send(e);
    })
})

/**
 * POST /users/login
 * Purpose: Login
 */
app.post('/users/login', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    

    User.findByCredentials(email, password).then((user) => {
        return user.createSession().then((refreshToken) => {
            // Session created successfully - refreshToken returned.
            // now we geneate an access auth token for the user

            return user.generateAccessAuthToken().then((accessToken) => {
                // access auth token generated successfully, now we return an object containing the auth tokens
                return { accessToken, refreshToken }
            });
        }).then((authTokens) => {
            // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
            res
                .header('x-refresh-token', authTokens.refreshToken)
                .header('x-access-token', authTokens.accessToken)
                .send(user);
        })
    }).catch((e) => {
        res.status(400).send(e);
    });
})

app.get('/users/me/access-token',verifySession,(req, res) => {
    // we know that the user/caller is authenticated and we have the user_id and user object available to us
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch((e) => {
        res.status(400).send(e);
    });
})
/* HELPER METHODS */
let deleteTasksFromList = (_listId) => {
    Task.deleteMany({
        _listId
    }).then(() => {
        console.log("Tasks from " + _listId + " were deleted!");
    })
}
let deleteTtasksFromTimetable = (_timetableId) => {
    Ttask.deleteMany({
        _timetableId
    }).then(() => {
        console.log("Ttasks from " + _timetableId + " were deleted!");
    })
}
app.listen(port,() => {
    console.log("server is listening at" + port);
})
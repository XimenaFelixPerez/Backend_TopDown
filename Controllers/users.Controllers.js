export const getUsers =(req,res) => {res.json({msg:"get Users"});}
export const getUser =(req,res) => {res.json({msg:"get User"+ req.params.id});}
export const postUsers =(req,res) => {res.json({msg:"post Users"});}
export const postUser =(req,res) => {res.json({msg:"post User"});}
export const putUser =(req,res) => {res.json({msg:"put User"});}
export const deleteUser =(req,res) => {res.json({msg:"delete User"});}
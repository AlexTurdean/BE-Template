const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const {Op} = require('sequelize');
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id',getProfile ,async (req, res) =>{
    const {Contract} = req.app.get('models')
    const profile = req.profile
    const {id} = req.params
    const contract = await Contract.findOne({where: {id}})
    if(!contract) return res.status(404).end()
    if((profile.type == 'client' && contract.ClientId != profile.id) ||
        (profile.type == 'contractor' && contract.ContractorId != profile.id) )
            return res.status(403).end()
    res.json(contract)
})

app.get('/contracts',getProfile ,async (req, res) =>{
    const {Contract} = req.app.get('models')
    const profile = req.profile

    let whereClause = { status: { [Op.ne]: "terminated" } }
    if(profile.type == "client")
        whereClause.ClientId = profile.id
    else
        whereClause.ContractId = profile.id

    const contracts = await Contract.findAll({where: whereClause})
    res.json(contracts)
})

app.get('/jobs/unpaid', getProfile, async (req, res) =>{
    const {Contract, Job} = req.app.get('models')
    const profile = req.profile

    let whereClause = { status: "in_progress" }
    if(profile.type == "client")
        whereClause.ClientId = profile.id
    else
        whereClause.ContractId = profile.id

    const contracts = await Job.findAll({
        where: {paid: null},
        include: [{
            model:Contract,
            where: whereClause,
            attributes: []
        }]
    })
    res.json(contracts)
})

module.exports = app;

const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const {clientPay} = require('./middleware/clientPay')
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

app.post('/jobs/:job_id/pay', getProfile, clientPay,  async (req, res) =>{
    const {Profile, Contract} = req.app.get('models')
    let profile = req.profile
    let job = req.job

    let contract = await Contract.findOne({where: {id: job.ContractId}});
    let contractorProfile = await Profile.findOne({
        where: {id: contract.ContractorId }
    })

    job.paid = true;
    job.paymentDate = new Date();
    await job.save();
    profile.balance -=job.price;
    await profile.save();
    contractorProfile.balance += job.price;
    await contractorProfile.save();
    res.status(200).end();

})

/// It's not clear who makes the deposit, here i will assume a thid-party. This route will require some authorization
/// I guess if it was from client to client it would be called transfer hahaha
app.post('/balances/deposit/:userId', async (req, res) =>{
    const {Profile, Contract, Job} = req.app.get('models')
    const {depositAmount} = req.body
    if(isNaN(depositAmount))
        return res.status(400).send("depositAmount is required with a number value");

    let profile = await Profile.findOne({
        where: {id: req.params.userId}
    });
    if(!profile)
        return res.status(404).end();
    if(profile.type != "client")
        return res.status(400).send("Cannot deposit in non-client account");

    const totalToPay = await Job.sum("price", {
        where:{
            paid: null
        },
        include:[{
            model: Contract,
            where:{
                ClientId: profile.id
            }
        }]
    });
    if(totalToPay < depositAmount * 4)
        return res.status(400).send("You can't depost more than 25% of the client's jobs to pay");

    profile.balance += depositAmount;
    await profile.save();
    res.status(200).end();

})

module.exports = app;

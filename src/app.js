const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const {clientPay} = require('./middleware/clientPay')
const {Op, fn, col} = require('sequelize');
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

app.use(function errorHandler (err, req, res, next) {
    const status = err.status || 500;
    const message = err.message || 'Something went wrong';
    res.status(status).send({status, message});
});

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

    Contract.findAll({where: whereClause}).then(contracts =>{
        res.json(contracts)
    }).catch(err => {
        next(err);
    })
})

app.get('/jobs/unpaid', getProfile, async (req, res) =>{
    const {Contract, Job} = req.app.get('models')
    const profile = req.profile

    let whereClause = { status: "in_progress" }
    if(profile.type == "client")
        whereClause.ClientId = profile.id
    else
        whereClause.ContractId = profile.id

    Job.findAll({
        where: {paid: null},
        include: [{
            model:Contract,
            where: whereClause,
            attributes: []
        }]
    }).then(contracts => {
        res.json(contracts)
    }).catch(err => {
        next(err);
    })
})

app.post('/jobs/:job_id/pay', getProfile, clientPay,  async (req, res) =>{
    const {Profile, Contract} = req.app.get('models')
    let profile = req.profile
    let job = req.job

    try {
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
    } catch (err) {
        next(err);
    }

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
    try {
        let totalToPay = await Job.sum("price", {
            where:{
                paid: null
            },
            include:[{
                model: Contract,
                where:{
                    ClientId: profile.id
                }
            }]
        })
        if(totalToPay < depositAmount * 4)
            return res.status(400).send("You can't depost more than 25% of the client's jobs to pay");
        profile.balance += depositAmount;
        await profile.save();
        res.status(200).end();
    } catch(err) {
        next(err);
    }
})

///It will require some kind of authentication
///Date are in format YYYY-MM-DD
///Parsing takes in consideration the timezone, it would require some more attention
app.get('/admin/best-profession', async (req, res) =>{
    const {Profile, Contract, Job} = req.app.get('models')
    let {start, end} = req.query
    if(isNaN(Date.parse(start)) || isNaN(Date.parse(end)))
        return res.status(400).send("Start date and end date are required");
    start = new Date(start)
    end = new Date(end)

    Profile.findAll({
        where: { type: 'contractor'},
        attributes: [ 'profession','id' ],
        include:[{
            model: Contract,
            as: 'Contractor',
            required: true,
            attributes: [],
            include: [{
                model: Job,
                attributes:[ [fn('SUM', col('price')), 'total'] ],
                where: {
                    paymentDate: {
                        [Op.between]: [start, end]
                    },
                    paid: true
                }
            }]
        }],
        raw: true,
        group: ["Profile.id"]  /// profession that earned the most money is the max out of contractors i suppose, if you want total paid for a profession change to -> group: ["Profile.profession"]
        //limit: 1,
        //order:[['Profile.Contractor.Jobs.total']]
    }).then(contractors => {
        let result = {total: 0}
        contractors.forEach(item => {
            if(item["Contractor.Jobs.total"] > result.total)
                result = {
                    profession: item.profession,
                    total: item["Contractor.Jobs.total"]
                }
        });
        res.json(result);
    }).catch(err => {
        next(err);
    });
})

app.get('/admin/best-clients', async (req, res) =>{
    const {Profile, Contract, Job} = req.app.get('models')
    let {start, end, limit=2} = req.query
    if(isNaN(Date.parse(start)) || isNaN(Date.parse(end)))
        return res.status(400).send("Start date and end date are required");
    start = new Date(start)
    end = new Date(end)

    let topClients = await Job.findAll({
        attributes:[ [fn('SUM', col('price')), 'total'] ],
        where: {
            paymentDate: {
                [Op.between]: [start, end]
            },
            paid: true
        },
        include:[{
            model: Contract,
            required: true,
            attributes: ['ClientId'],
            include: [{
                model:Profile,
                as: 'Client',
                attributes: ['firstName', 'lastName', 'id']
            }]
        }],
        group: ["Contract.ClientId"],
        order: [ [ fn('SUM', col('price')), 'DESC'] ],
        limit,
        raw:true
    }).then(topClients => {
        let result = topClients.map(item => {
            return {
                id: item['Contract.Client.id'],
                fullname: (item['Contract.Client.firstName'] + " " +
                  item['Contract.Client.lastName']),
                paid: item.total,
            }
        });
        res.json(result);
    }).catch(err => {
        next(err);
    })
})

module.exports = app;

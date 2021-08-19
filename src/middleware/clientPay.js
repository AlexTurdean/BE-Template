const clientPay = async (req, res, next) => {
    const {Job} = req.app.get('models')
    const profile = req.profile

    if(profile.type != 'client')
        return res.status(400).send("Only clients can pay jobs")

    const job = await Job.findOne({where: {id: req.params.job_id}})
    if(!job) return res.status(404).end()
    if(job.paid == true)
        return res.status(400).send("Job is already paid")
    if(job.price > profile.balance)
        return res.status(400).send("Your balance is too low to pay this job")
    req.job = job
    next()
}
module.exports = {clientPay}

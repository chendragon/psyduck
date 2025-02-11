import fs from 'fs'
import path from 'path';
import {fileURLToPath} from 'url';
import ini from 'ini'
import axios from "axios";

class Ql {
    constructor() {
        const dirpath = fileURLToPath(import.meta.url);
        const abspath = path.dirname(dirpath)
        let iniText = fs.readFileSync(`${abspath}/config/config.ini`, 'UTF-8')
        let obj = ini.parse(iniText)
        let env = obj.env
        this.config = {
            baseURL: env.QINGLONG_BaseUrl || 'http://127.0.0.1:5700',
            clientId: env.QINGLONG_ClientId,
            clientSecret: env.QINGLONG_ClientSecret
        };
        this.token = null
    }

    // 获取 token
    async getToken() {
        try {
            const response = await axios.get(`${this.config.baseURL}/open/auth/token`, {
                params: {
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret
                }
            });
            this.token = response.data.data.token;
            return this.token;
        } catch (error) {
            console.error('[Error] 获取qinglong token失败', error);
            throw error;
        }
    }

    async setEnvs(data) {
        const token = this.token
        try {
            const response = await axios.put(
                `${this.config.baseURL}/open/envs`,
                data,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('[Error] 更新环境变量失败:', error);
        }
    }

    // 获取环境变量
    async getEnvs(search = null) {
        const token = this.token
        try {
            const response = await axios.get(`${this.config.baseURL}/open/envs?searchValue=${search}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data.data;
        } catch (error) {
            console.error('[Error] 获取qinglong环境变量失败:', error);
            throw error;
        }
    }

    // 添加环境变量
    async addEnv(name, value, remarks = '') {
        const token = this.token
        try {
            const response = await axios.post(`${this.config.baseURL}/open/envs`, [{
                name,
                value,
                remarks
            }], {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('[Error] 添加qinglong环境变量失败');
            throw error;
        }
    }

    // 删除环境变量
    async deleteEnv(envId) {
        const token = this.token
        try {
            const response = await axios.delete(`${this.config.baseURL}/open/envs`, {
                data: [envId],
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('[Error] 删除qinglong环境变量失败');
            throw error;
        }
    }

    // 获取定时任务列表
    async getCrons() {
        const token = this.token
        try {
            const response = await axios.get(`${this.config.baseURL}/open/crons`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data.data;
        } catch (error) {
            console.error('[Error] 获取qinglong定时任务失败');
            throw error;
        }
    }

    // 运行任务
    async runCrons(cronIds) {
        const token = this.token
        try {
            const response = await axios.put(`${this.config.baseURL}/open/crons/run`, cronIds, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('[Error] 运行qinglong任务失败');
            throw error;
        }
    }

    // 获取任务日志
    async getCronLogs(cronId) {
        const token = this.token
        try {
            const response = await axios.get(`${this.config.baseURL}/open/crons/${cronId}/log`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data.data;
        } catch (error) {
            console.error('获取任务日志失败:', error);
            throw error;
        }
    }

    async addCron(command) {
        const token = this.token
        try {
            const response = await axios.post(
                `${this.config.baseURL}/open/crons`,
                command,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('[Error] 创建定时任务失败:', error);
            throw error;
        }
    }

    async wait(t) {
        return new Promise(e => setTimeout(e, t))
    }

    async create() {
        await this.getToken()
        let dirpath = fileURLToPath(import.meta.url);
        let abspath = path.dirname(dirpath)
        let crons = await this.getCrons()
        let data = {}
        for (let i of crons.data) {
            let command = i.command.match(/task\s*qitoqito_psyduck\/(\w+\.js)/)
            if (command) {
                let script = command[1]
                data[script] = {
                    name: i.name,
                    schedule: i.schedule,
                    id: i.id,
                    command: i.command
                }
            }
        }
        let dicts = {}
        let dir = fs.readdirSync(`${abspath}/parse`);
        dir.forEach(async function(item, index) {
            let stat = fs.lstatSync(`${abspath}/parse/` + item)
            if (stat.isDirectory() === true) {
                for (let script of fs.readdirSync(`${abspath}/parse/${item}`)) {
                    try {
                        if (script.match(/\w+\_\w+\_\w/)) {
                            let imp = await import(`${abspath}/parse/${item}/${script}`)
                            let psyDuck = new imp.Main()
                            let crontab = psyDuck.crontab()
                            let code = `
import path from 'path';
import {
    fileURLToPath
} from 'url';
!(async () => {
    let dirpath = fileURLToPath(import.meta.url).replace('.swap','');
    let abspath = path.dirname(dirpath)
    let filename = dirpath.match(/(\\w+)\\.js/)[1]
    let type = filename.split('_')[0]
    if (['js', 'jx', 'jr', 'jw'].includes(type)) {
        type = 'jd'
    }
    let length = process.argv.length
    let params = {
        filename
    }
    if (length > 2) {
        for (let i = 2; i < length; i++) {
            let key = process.argv[i].match(/^-\\w+$/)
            if (key) {
                params[key[0].substr(1)] = process.argv[i + 1]
            }
        }
    }
    let psyDuck = await import (\`\${abspath}/parse/\${type}/\${filename}.js\`)
    let main = new psyDuck.Main()
    await main.init(params)
})().catch((e) => {
    console.log(e.message)
})`
                            fs.writeFile(`${abspath}/${script}`, code, function(err, data) {
                                if (err) {
                                    throw err;
                                }
                                console.log(`🐯‍❄️ 写入成功: ${script}`)
                            })
                            if (!data[script]) {
                                dicts[script] = {
                                    name: `PsyDuck_${psyDuck.profile.title}`,
                                    schedule: crontab,
                                    command: `task qitoqito_psyduck/${script}`,
                                    labels: [`PsyDuck`]
                                }
                            }
                        }
                    } catch (e) {
                        console.log(`🐽🐽️ 写入失败: ${script}`)
                    }
                }
            }
        })
        await this.wait(20000)
        let commands = Object.values(dicts)
        for (let i in dicts) {
            try {
                let add = await this.addCron(dicts[i])
                if (add.data.name) {
                    console.log('任务添加成功: ', i)
                }
            } catch (e) {
                console.log('任务添加失败: ', i)
            }
        }
    }
}

let qinglong = new Ql()
qinglong.create()

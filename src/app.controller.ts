import {
  Controller,
  Get,
  Render,
  Query,
  Redirect,
  Req,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './users/users.service';
import axios, { AxiosResponse } from 'axios';
import { Octokit } from '@octokit/rest';
import { Base64 } from 'js-base64';
import { join } from 'path';
import * as fs from 'fs';

@Controller()
export class AppController {
  constructor(private readonly userService: UserService) {}
  /**
   * The root route for this server.
   * @render index.hbs
   */
  @Get()
  @Render('index')
  render(): any {
    return {};
  }

  /**
   * @redirect to Github Login page.
   */
  @Get('login')
  @Redirect()
  login(): any {
    return {
      url: `https://github.com/login/oauth/authorize?scope=public_repo,user,delete_repo&client_id=${process.env.CLIENT_ID}`,
    };
  }

  /**
   * A callback route for the Github auth API to redirect to.
   */
  @Get('callback')
  async authCallback(@Query() query: any, @Res() res: any): Promise<void> {
    const code: string = query.code;
    const response: AxiosResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
      },
    );
    const params: URLSearchParams = new URLSearchParams(response.data);
    console.log(params.get('access_token'));
    const octokit: Octokit = new Octokit({ auth: params.get('access_token') });
    const {
      data: { login },
    }: { data: { login: string } } =
      await octokit.rest.users.getAuthenticated();
    await this.userService.createUser(login, params.get('access_token'));
    res.redirect(`/home?username=${login}`);
  }

  /**
   * @render home.hbs after auth with Github API is successful
   * This page contains options for creating and deleting a repository.
   */
  @Get('home')
  @Render('home')
  renderHome(@Query() query: any, @Res() res: any): any {
    if (!query.username) {
      res.redirect('/');
      return {};
    }
    return { user: query.username };
  }

  /**
   * A fallback route after a repository is successfully created.
   */
  @Post('create_repo')
  async createRepo(@Body() body: any, @Res() res: any): Promise<any> {
    if (!body.username || !body.repoName) {
      console.log("hi1");
      console.log(body);
      res.redirect('/home');
      return {};
    }
    const accessToken: string = await this.userService.getAccessToken(
      body.username,
    );
    console.log("hi");
    const octokit: Octokit = new Octokit({ auth: accessToken });
    try {
      const content = fs.readFileSync(
        join(__dirname, '../dummyInput.txt'),
        'utf-8',
      );
      const contentEncoded = Base64.encode(content);
      console.log(contentEncoded);
      await octokit.request('POST /user/repos', {
        name: body.repoName,
      });
      await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: body.username,
        repo: body.repoName,
        path: 'readme.md',
        message: 'Commit using Github API',
        content: contentEncoded,
      });
      res.redirect(
        `/repo-success?username=${body.username}&repoName=${body.repoName}`,
      );
    } catch (e: any) {
      console.log(e);
      res.redirect(`/home?username=${body.username}`);
    }
  }

  @Get('repo-success')
  @Render('success')
  renderSuccess(@Query() query: any): any {
    return { repoName: query.repoName, username: query.username };
  }

  /**
   * A fallback route after a repository is successfully deleted.
   */
  @Post('delete_repo')
  @Render('delete')
  async deleteRepo(@Req() req: Request, @Res() res: any): Promise<any> {
    if (!req.body.username || !req.body.repoName) {
      res.redirect('/home');
      return {};
    }
    const accessToken: string = await this.userService.getAccessToken(
      req.body.username,
    );
    const octokit: Octokit = new Octokit({ auth: accessToken });
    try {
      await octokit.request(
        `DELETE /repos/${req.body.username}/${req.body.repoName}`,
      );
    } catch (e: any) {
      res.redirect(`/home?username=${req.body.username}`);
      return {};
    }
    return { repoName: req.body.repoName, username: req.body.username };
  }
}

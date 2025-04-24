import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, Res, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto, SignUpDto } from './dto';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { User } from '../user/entities';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @ApiOperation({ summary: 'User Sign-Up' })
  @ApiBody({ type: SignUpDto, description: 'User Sign-Up Data' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'User successfully signed up. Refresh token set in httpOnly cookie.',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid data.' })
  async signUp(@Body() signUpDto: SignUpDto, @Res() res: Response) {
    return await this.authService.signUp(signUpDto, res);
  }

  @Post('sign-in')
  @ApiOperation({ summary: 'User Sign-In' })
  @ApiBody({ type: SignInDto, description: 'User Sign-In Data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully signed in. Access token generated.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials.',
  })
  async signIn(@Body() signInDto: SignInDto, @Res() res: Response) {
    return await this.authService.signIn(signInDto, res);
  }

  @Post('sign-out')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'User Sign-Out' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'User successfully signed out. Refresh token cleared from the cookie.',
  })
  async signOut(@CurrentUser() user: Partial<User>, @Res() res: Response) {
    return await this.authService.signOut(user, res);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh Access Token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access token successfully refreshed.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token.',
  })
  async refreshAccessToken(@Body() token: string, @Res() res: Response) {
    return await this.authService.refreshAccessToken(token, res);
  }
}

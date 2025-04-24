import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { SignInDto, SignUpDto } from './dto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signUp(signUpDto: SignUpDto, res: Response) {
    try {
      const { password, ...userInfo } = signUpDto;
      let hashedPassword: string;

      try {
        const saltOrRounds = 10;
        hashedPassword = await bcrypt.hash(password, saltOrRounds);
      } catch (err) {
        throw new HttpException(
          'Error hashing password',
          HttpStatus.BAD_REQUEST,
        );
      }

      const newUser = await this.userService.create({
        ...userInfo,
        password: hashedPassword,
      });

      const { id, email } = newUser;
      const accessToken = this.generateAccessToken(id, email);
      const refreshToken = this.generateRefreshToken(id, email);

      await this.userService.update(id, { refresh_token: refreshToken });

      return res.json({ accessToken, newUser });
    } catch (err) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'An error occurred during signup. Please try again later.',
      });
    }
  }

  async signIn(signInDto: SignInDto, res: Response) {
    const { email, password } = signInDto;
    try {
      const user = await this.userService.findUserByEmail(email);

      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const { id } = user;
      const accessToken = this.generateAccessToken(id, email);
      const refreshToken = this.generateRefreshToken(id, email);

      await this.userService.update(id, { refresh_token: refreshToken });

      const currentUser = await this.userService.findOne(user.id);
      return res.json({ accessToken, currentUser });
    } catch (err) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: 'Sign-in failed. Please try again later.',
      });
    }
  }

  async signOut(user: Partial<User>, res: Response) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User identification is missing')
    }

    try {
      await this.userService.update(user.id, { refresh_token: null });
      
      return res.status(HttpStatus.OK).json({ message: 'Sign-out successful' });
    } catch (err) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'An error occurred during sign-out. Please try again later.',
      });
    }
  }

  async refreshAccessToken(token: string, res: Response) {
    if (!token) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });

      const user = await this.userService.findUserByEmail(decoded.email);
      
      if (!user || user.refresh_token !== token) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const newAccessToken = this.generateAccessToken(user.id, user.email);
      const newRefreshToken = this.generateRefreshToken(user.id, user.email);

      await this.userService.update(user.id, { refresh_token: newRefreshToken });

      return res.json({
        accessToken: newAccessToken,
      });
    } catch (err) {
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  private generateAccessToken(id: string, email: string): string {
    const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
    const accessToken = this.jwtService.sign(
      { id, email },
      { secret: ACCESS_TOKEN_SECRET, expiresIn: '1d' },
    );
    return accessToken;
  }

  private generateRefreshToken(id: string, email: string): string {
    const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
    const refreshToken = this.jwtService.sign(
      { id, email },
      { secret: REFRESH_TOKEN_SECRET, expiresIn: '1d' },
    );
    return refreshToken;
  }
}

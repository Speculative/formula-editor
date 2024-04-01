import { default as React, useState, useRef } from "react";
import { css } from "@emotion/react";

import { styleStore } from "./store";

export const Menu = () => {
  return (
    <div
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2rem;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        background: #f0f0f0;
      `}
    >
      <ColorMenu />
      <BoxMenu />
    </div>
  );
};

type MenuItemProps = {
  onClick: () => void;
};

const MenuItem = ({
  children,
  onClick,
}: React.PropsWithChildren<MenuItemProps>) => {
  return (
    <div
      css={css`
        height: 2rem;
        min-width: 2rem;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        &:hover {
          background: #e0e0e0;
        }
      `}
      onClick={(e) => {
        onClick();
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
};

type ColorSwatchProps = {
  color: string;
  onClick?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
};

const ColorSwatch = ({ color, onClick }: ColorSwatchProps) => {
  return (
    <div
      onClick={onClick}
      css={css`
        width: 1rem;
        height: 1rem;
        background-color: ${color};
        border: 1px solid black;
      `}
    ></div>
  );
};

type SubMenuProps = {
  menuButton: React.ReactNode;
};

const SubMenu = ({
  menuButton,
  children,
}: React.PropsWithChildren<SubMenuProps>) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div
      css={css`
        position: relative;
      `}
    >
      <MenuItem
        onClick={() => {
          setOpen(!open);
        }}
      >
        {menuButton}
        {open && (
          <div
            css={css`
              position: absolute;
              top: 2rem;
              left: 0;
              display: flex;
              flex-direction: column;
              background: #f0f0f0;
            `}
          >
            {children}
          </div>
        )}
      </MenuItem>
    </div>
  );
};

const ColorMenu = () => {
  const colors = [
    "#000000",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#00FFFF",
    "#FF00FF",
  ];

  return (
    <SubMenu menuButton={<ColorSwatch color="#0000FF" />}>
      <div
        css={css`
          padding: 0.5rem;
          width: 7rem;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
        `}
      >
        {colors.map((color) => (
          <div
            key={color}
            css={css`
              margin: 0.25rem;
            `}
            onClick={(e) => {
              styleStore.setSelectionColor(color);
              e.stopPropagation();
            }}
          >
            <ColorSwatch key={color} color={color} />
          </div>
        ))}
      </div>
    </SubMenu>
  );
};

const BoxMenu = () => {
  return (
    <SubMenu menuButton={<ColorSwatch color="#FF0000" />}>
      {"Unfinished Box menu"}
    </SubMenu>
  );
};
